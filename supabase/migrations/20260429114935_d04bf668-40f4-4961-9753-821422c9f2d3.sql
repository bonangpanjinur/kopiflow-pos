
-- Columns
ALTER TABLE public.coffee_shops
  ADD COLUMN IF NOT EXISTS last_dns_check_at timestamptz;

ALTER TABLE public.billing_settings
  ADD COLUMN IF NOT EXISTS cron_secret text;

-- Domain blacklist
CREATE TABLE IF NOT EXISTS public.domain_blacklist (
  domain text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.domain_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domain_blacklist_read_auth"
  ON public.domain_blacklist FOR SELECT TO authenticated USING (true);

CREATE POLICY "domain_blacklist_super_admin_write"
  ON public.domain_blacklist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.domain_blacklist (domain, reason) VALUES
  ('localhost', 'reserved'),
  ('www', 'reserved label'),
  ('api', 'reserved label'),
  ('app', 'reserved label'),
  ('admin', 'reserved label'),
  ('lovable.app', 'platform'),
  ('lovable.dev', 'platform'),
  ('lovableproject.com', 'platform'),
  ('kopihub.app', 'platform')
ON CONFLICT (domain) DO NOTHING;

-- Verification attempts (rate-limit)
CREATE TABLE IF NOT EXISTS public.domain_verify_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  actor_id uuid,
  domain text,
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dva_shop_time ON public.domain_verify_attempts(shop_id, created_at DESC);
ALTER TABLE public.domain_verify_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dva_owner_read"
  ON public.domain_verify_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.coffee_shops s WHERE s.id = shop_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "dva_owner_insert"
  ON public.domain_verify_attempts FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.coffee_shops s WHERE s.id = shop_id AND s.owner_id = auth.uid())
  );

-- Auto-unverify helper (called by cron via service role)
CREATE OR REPLACE FUNCTION public.auto_unverify_domain(_shop_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coffee_shops
    SET custom_domain_verified_at = NULL,
        last_dns_check_at = now(),
        updated_at = now()
    WHERE id = _shop_id;
  INSERT INTO public.domain_audit (shop_id, action, notes)
    VALUES (_shop_id, 'auto_unverify', COALESCE(_reason, 'dns recheck failed'));
END;
$$;

-- Expire overdue plans (downgrade pro -> free, unverify domain)
CREATE OR REPLACE FUNCTION public.expire_overdue_plans()
RETURNS TABLE(shop_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH affected AS (
    UPDATE public.coffee_shops
      SET plan = 'free',
          custom_domain_verified_at = NULL,
          updated_at = now()
      WHERE plan = 'pro'
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at < now()
      RETURNING id
  )
  SELECT id FROM affected;
END;
$$;

-- Expire stale pending invoices (>7 days, no proof uploaded)
CREATE OR REPLACE FUNCTION public.expire_stale_pending_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.plan_invoices
      SET status = 'expired', updated_at = now()
      WHERE status = 'pending'
        AND payment_proof_url IS NULL
        AND created_at < now() - INTERVAL '7 days'
      RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;
