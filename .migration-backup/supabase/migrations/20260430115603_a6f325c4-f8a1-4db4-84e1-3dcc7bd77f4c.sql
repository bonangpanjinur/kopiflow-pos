-- G1: Super-admin shop management + performance indexes

-- 1. Suspension fields on businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

-- 2. Performance indexes for hot queries
CREATE INDEX IF NOT EXISTS idx_orders_shop_created
  ON public.orders (shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_outlet_status_created
  ON public.orders (outlet_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_channel_status
  ON public.orders (channel, status)
  WHERE channel = 'online';

CREATE INDEX IF NOT EXISTS idx_menu_items_shop_available
  ON public.menu_items (shop_id, is_available);

CREATE INDEX IF NOT EXISTS idx_categories_shop_active
  ON public.categories (shop_id, is_active);

CREATE INDEX IF NOT EXISTS idx_open_bills_outlet
  ON public.open_bills (outlet_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_owner_notif_shop_dismissed
  ON public.owner_notifications (shop_id, dismissed_at)
  WHERE dismissed_at IS NULL;

-- 3. RPC: admin dashboard stats (single round-trip)
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  month_start timestamptz := date_trunc('month', now());
  seven_days timestamptz := now() + interval '7 days';
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'shops', (SELECT count(*) FROM businesses),
    'pro', (SELECT count(*) FROM businesses WHERE plan = 'pro'),
    'pending', (SELECT count(*) FROM plan_invoices WHERE status = 'awaiting_review'),
    'mrr', COALESCE((SELECT sum(amount_idr) FROM plan_invoices WHERE status = 'paid' AND paid_at >= month_start), 0),
    'expiringSoon', (SELECT count(*) FROM businesses WHERE plan = 'pro' AND plan_expires_at >= now() AND plan_expires_at <= seven_days),
    'domainOffline', (SELECT count(*) FROM businesses WHERE custom_domain IS NOT NULL AND custom_domain_verified_at IS NULL),
    'suspended', (SELECT count(*) FROM businesses WHERE suspended_at IS NOT NULL)
  ) INTO result;

  RETURN result;
END;
$$;

-- 4. RPC: super-admin set plan manually (no invoice)
CREATE OR REPLACE FUNCTION public.admin_set_shop_plan(
  _shop_id uuid,
  _plan text,
  _expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_plan text;
  old_exp timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _plan NOT IN ('free','pro') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  SELECT plan, plan_expires_at INTO old_plan, old_exp FROM businesses WHERE id = _shop_id;

  UPDATE businesses
    SET plan = _plan,
        plan_expires_at = CASE WHEN _plan = 'pro' THEN _expires_at ELSE NULL END,
        updated_at = now()
    WHERE id = _shop_id;

  INSERT INTO system_audit (event_type, shop_id, actor_id, payload, notes)
  VALUES ('plan_manual_set', _shop_id, auth.uid(),
    jsonb_build_object('old_plan', old_plan, 'old_expires_at', old_exp, 'new_plan', _plan, 'new_expires_at', _expires_at),
    'super-admin manual override');
END;
$$;

-- 5. RPC: suspend / unsuspend
CREATE OR REPLACE FUNCTION public.admin_suspend_shop(_shop_id uuid, _reason text)
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
    SET suspended_at = now(), suspended_reason = _reason, is_active = false, updated_at = now()
    WHERE id = _shop_id;

  INSERT INTO system_audit (event_type, shop_id, actor_id, payload, notes)
  VALUES ('shop_suspended', _shop_id, auth.uid(), jsonb_build_object('reason', _reason), _reason);

  INSERT INTO owner_notifications (shop_id, type, severity, title, body, dedupe_key)
  VALUES (_shop_id, 'shop_suspended', 'error',
    'Toko Anda dinonaktifkan oleh admin',
    COALESCE(_reason, 'Hubungi admin untuk informasi lebih lanjut.'),
    'shop_suspended:' || to_char(now(), 'YYYY-MM-DD-HH24'))
  ON CONFLICT (shop_id, dedupe_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_shop(_shop_id uuid)
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
    SET suspended_at = NULL, suspended_reason = NULL, is_active = true, updated_at = now()
    WHERE id = _shop_id;

  INSERT INTO system_audit (event_type, shop_id, actor_id, payload, notes)
  VALUES ('shop_unsuspended', _shop_id, auth.uid(), '{}'::jsonb, NULL);
END;
$$;

-- 6. RPC: shop detail bundle (owner profile + counts)
CREATE OR REPLACE FUNCTION public.admin_shop_detail(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'shop', to_jsonb(s.*),
    'owner', jsonb_build_object(
      'id', s.owner_id,
      'display_name', p.display_name,
      'phone', p.phone
    ),
    'outlets_count', (SELECT count(*) FROM outlets WHERE shop_id = s.id),
    'orders_count', (SELECT count(*) FROM orders WHERE shop_id = s.id),
    'orders_30d', (SELECT count(*) FROM orders WHERE shop_id = s.id AND created_at >= now() - interval '30 days'),
    'menu_count', (SELECT count(*) FROM menu_items WHERE shop_id = s.id),
    'last_order_at', (SELECT max(created_at) FROM orders WHERE shop_id = s.id)
  ) INTO result
  FROM businesses s
  LEFT JOIN profiles p ON p.id = s.owner_id
  WHERE s.id = _shop_id;

  RETURN result;
END;
$$;

-- 7. Storefront should hide suspended shops automatically
DROP POLICY IF EXISTS shops_public_read_active ON public.businesses;
CREATE POLICY shops_public_read_active
  ON public.businesses
  FOR SELECT
  TO public
  USING (is_active = true AND suspended_at IS NULL);
