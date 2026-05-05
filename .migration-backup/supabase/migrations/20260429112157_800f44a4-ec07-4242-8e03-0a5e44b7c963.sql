-- 1. Extend app_role enum with super_admin
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Add plan & custom domain fields to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_verify_token text;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_custom_domain_key
  ON public.businesses (lower(custom_domain))
  WHERE custom_domain IS NOT NULL;

-- 3. plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  price_idr int NOT NULL,
  duration_days int NOT NULL,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_read_all ON public.plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY plans_super_admin_write ON public.plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed default plans
INSERT INTO public.plans (code, name, price_idr, duration_days, features, sort_order) VALUES
  ('pro_monthly', 'Pro Bulanan', 99000, 30, '{"custom_domain": true, "remove_branding": false}'::jsonb, 1),
  ('pro_yearly',  'Pro Tahunan', 990000, 365, '{"custom_domain": true, "remove_branding": false}'::jsonb, 2)
ON CONFLICT (code) DO NOTHING;

-- 4. billing_settings (singleton)
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name text,
  account_no text,
  account_name text,
  qris_image_url text,
  instructions text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.billing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_settings_read_all ON public.billing_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY billing_settings_super_admin_write ON public.billing_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. plan_invoices
CREATE TABLE IF NOT EXISTS public.plan_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  invoice_no text UNIQUE NOT NULL,
  amount_idr int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  payment_proof_url text,
  paid_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_invoices_shop_idx ON public.plan_invoices(shop_id);
CREATE INDEX IF NOT EXISTS plan_invoices_status_idx ON public.plan_invoices(status);

ALTER TABLE public.plan_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_invoices_owner_select ON public.plan_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses s
            WHERE s.id = plan_invoices.shop_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY plan_invoices_owner_insert ON public.plan_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses s
            WHERE s.id = plan_invoices.shop_id AND s.owner_id = auth.uid())
  );

CREATE POLICY plan_invoices_owner_update_proof ON public.plan_invoices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses s
            WHERE s.id = plan_invoices.shop_id AND s.owner_id = auth.uid())
    AND status IN ('pending','awaiting_review')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses s
            WHERE s.id = plan_invoices.shop_id AND s.owner_id = auth.uid())
    AND status IN ('pending','awaiting_review')
  );

CREATE POLICY plan_invoices_super_admin_all ON public.plan_invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 6. domain_audit
CREATE TABLE IF NOT EXISTS public.domain_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  old_domain text,
  new_domain text,
  action text NOT NULL,
  actor_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS domain_audit_shop_idx ON public.domain_audit(shop_id);

ALTER TABLE public.domain_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY domain_audit_owner_select ON public.domain_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses s
            WHERE s.id = domain_audit.shop_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY domain_audit_owner_insert ON public.domain_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.businesses s
              WHERE s.id = domain_audit.shop_id AND s.owner_id = auth.uid())
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

-- 7. updated_at triggers
DROP TRIGGER IF EXISTS plans_touch ON public.plans;
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS plan_invoices_touch ON public.plan_invoices;
CREATE TRIGGER plan_invoices_touch BEFORE UPDATE ON public.plan_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. RPC: super admin approve invoice (atomic invoice + shop update)
CREATE OR REPLACE FUNCTION public.approve_plan_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_inv plan_invoices%ROWTYPE;
  v_plan plans%ROWTYPE;
  v_new_expiry timestamptz;
  v_base timestamptz;
BEGIN
  IF NOT public.has_role(v_caller, 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_inv FROM plan_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_inv.status = 'paid' THEN RAISE EXCEPTION 'already_paid'; END IF;

  SELECT * INTO v_plan FROM plans WHERE id = v_inv.plan_id;

  -- Extend from current expiry if still active, else from now
  SELECT GREATEST(COALESCE(plan_expires_at, now()), now()) INTO v_base
    FROM businesses WHERE id = v_inv.shop_id;
  v_new_expiry := v_base + (v_plan.duration_days || ' days')::interval;

  UPDATE plan_invoices
    SET status = 'paid', paid_at = now(),
        reviewed_by = v_caller, reviewed_at = now(),
        updated_at = now()
    WHERE id = _invoice_id;

  UPDATE businesses
    SET plan = 'pro', plan_expires_at = v_new_expiry, updated_at = now()
    WHERE id = v_inv.shop_id;

  RETURN jsonb_build_object('shop_id', v_inv.shop_id, 'plan_expires_at', v_new_expiry);
END;
$$;

-- 9. RPC: super admin reject invoice
CREATE OR REPLACE FUNCTION public.reject_plan_invoice(_invoice_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE plan_invoices
    SET status = 'rejected', notes = COALESCE(_reason, notes),
        reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = _invoice_id;
END;
$$;

-- 10. RPC: super admin verify custom domain
CREATE OR REPLACE FUNCTION public.set_custom_domain_verified(_shop_id uuid, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE businesses
    SET custom_domain_verified_at = CASE WHEN _verified THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = _shop_id;

  INSERT INTO domain_audit (shop_id, action, actor_id, notes)
  VALUES (_shop_id, CASE WHEN _verified THEN 'verify' ELSE 'unverify' END, auth.uid(), 'super admin');
END;
$$;

-- 11. Storage RLS for payment-proofs bucket (path: shop_id/...)
DROP POLICY IF EXISTS payment_proofs_owner_read ON storage.objects;
DROP POLICY IF EXISTS payment_proofs_owner_write ON storage.objects;
DROP POLICY IF EXISTS payment_proofs_super_admin_all ON storage.objects;

CREATE POLICY payment_proofs_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs' AND (
      EXISTS (
        SELECT 1 FROM public.businesses s
        WHERE s.owner_id = auth.uid()
          AND s.id::text = (storage.foldername(name))[1]
      )
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY payment_proofs_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs' AND
    EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY payment_proofs_super_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'super_admin'));