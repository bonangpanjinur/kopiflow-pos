-- Cron run history
CREATE TABLE public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running | success | error
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer
);
CREATE INDEX idx_cron_runs_started ON public.cron_runs (started_at DESC);
CREATE INDEX idx_cron_runs_job ON public.cron_runs (job_name, started_at DESC);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY cron_runs_super_admin_read ON public.cron_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- System audit log (admin-only events)
CREATE TABLE public.system_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL, -- plan_downgrade | plan_approve | plan_reject | invoice_expire | domain_auto_unverify | domain_force_verify | cron_run
  shop_id uuid,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text
);
CREATE INDEX idx_system_audit_created ON public.system_audit (created_at DESC);
CREATE INDEX idx_system_audit_event ON public.system_audit (event_type, created_at DESC);
CREATE INDEX idx_system_audit_shop ON public.system_audit (shop_id, created_at DESC);

ALTER TABLE public.system_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_audit_super_admin_read ON public.system_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Owner notifications (in-app reminders)
CREATE TABLE public.owner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  type text NOT NULL, -- plan_expiring | plan_expired | invoice_pending | domain_offline | invoice_approved | invoice_rejected
  title text NOT NULL,
  body text,
  link text,
  severity text NOT NULL DEFAULT 'info', -- info | warning | danger | success
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text -- to avoid duplicate reminders per shop+type+window
);
CREATE INDEX idx_owner_notif_shop ON public.owner_notifications (shop_id, created_at DESC);
CREATE UNIQUE INDEX idx_owner_notif_dedupe ON public.owner_notifications (shop_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_notif_owner_read ON public.owner_notifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

CREATE POLICY owner_notif_owner_update ON public.owner_notifications
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

CREATE POLICY owner_notif_super_admin_all ON public.owner_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Helper RPC: generate reminders for all shops (called from cron)
CREATE OR REPLACE FUNCTION public.generate_owner_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expiring int := 0;
  v_expired int := 0;
  v_invoice int := 0;
  v_domain int := 0;
BEGIN
  -- Plan expiring within 7 days (still pro)
  WITH ins AS (
    INSERT INTO public.owner_notifications (shop_id, type, title, body, link, severity, dedupe_key)
    SELECT s.id, 'plan_expiring',
           'Plan Pro akan berakhir',
           'Plan Pro Anda akan berakhir pada ' || to_char(s.plan_expires_at AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY HH24:MI'),
           '/app/billing', 'warning',
           'plan_expiring:' || to_char(s.plan_expires_at, 'YYYY-MM-DD')
    FROM coffee_shops s
    WHERE s.plan = 'pro'
      AND s.plan_expires_at IS NOT NULL
      AND s.plan_expires_at > now()
      AND s.plan_expires_at < now() + interval '7 days'
    ON CONFLICT (shop_id, dedupe_key) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_expiring FROM ins;

  -- Plan expired (now free)
  WITH ins AS (
    INSERT INTO public.owner_notifications (shop_id, type, title, body, link, severity, dedupe_key)
    SELECT s.id, 'plan_expired',
           'Plan Pro telah berakhir',
           'Akun Anda otomatis turun ke Free. Custom domain dinonaktifkan sementara.',
           '/app/billing', 'danger',
           'plan_expired:' || to_char(COALESCE(s.plan_expires_at, now()), 'YYYY-MM-DD')
    FROM coffee_shops s
    WHERE s.plan = 'free'
      AND s.plan_expires_at IS NOT NULL
      AND s.plan_expires_at < now()
      AND s.plan_expires_at > now() - interval '14 days'
    ON CONFLICT (shop_id, dedupe_key) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_expired FROM ins;

  -- Invoice pending > 2 days without proof
  WITH ins AS (
    INSERT INTO public.owner_notifications (shop_id, type, title, body, link, severity, dedupe_key)
    SELECT i.shop_id, 'invoice_pending',
           'Invoice menunggu pembayaran',
           'Invoice ' || i.invoice_no || ' sudah ' || extract(day from now() - i.created_at)::int || ' hari menunggu bukti pembayaran.',
           '/app/billing', 'warning',
           'invoice_pending:' || i.id::text
    FROM plan_invoices i
    WHERE i.status = 'pending'
      AND i.payment_proof_url IS NULL
      AND i.created_at < now() - interval '2 days'
      AND i.created_at > now() - interval '7 days'
    ON CONFLICT (shop_id, dedupe_key) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_invoice FROM ins;

  -- Domain offline (was verified, now auto-unverified)
  WITH ins AS (
    INSERT INTO public.owner_notifications (shop_id, type, title, body, link, severity, dedupe_key)
    SELECT s.id, 'domain_offline',
           'Custom domain offline',
           'Domain ' || s.custom_domain || ' tidak lagi terdeteksi. Periksa pengaturan DNS Anda.',
           '/app/domain', 'danger',
           'domain_offline:' || s.custom_domain || ':' || to_char(s.last_dns_check_at, 'YYYY-MM-DD')
    FROM coffee_shops s
    WHERE s.custom_domain IS NOT NULL
      AND s.custom_domain_verified_at IS NULL
      AND s.last_dns_check_at IS NOT NULL
      AND s.last_dns_check_at > now() - interval '24 hours'
    ON CONFLICT (shop_id, dedupe_key) DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_domain FROM ins;

  RETURN jsonb_build_object(
    'plan_expiring', v_expiring,
    'plan_expired', v_expired,
    'invoice_pending', v_invoice,
    'domain_offline', v_domain
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_owner_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_owner_reminders() TO service_role;

-- Helper RPC: log a system audit event (callable from server functions w/ service role)
CREATE OR REPLACE FUNCTION public.log_system_event(
  _event_type text,
  _shop_id uuid,
  _payload jsonb DEFAULT '{}'::jsonb,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.system_audit (event_type, shop_id, payload, notes)
  VALUES (_event_type, _shop_id, COALESCE(_payload, '{}'::jsonb), _notes)
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION public.log_system_event(text, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_system_event(text, uuid, jsonb, text) TO service_role;