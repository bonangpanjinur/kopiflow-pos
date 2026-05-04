-- Promo type enum
CREATE TYPE public.promo_type AS ENUM ('percent', 'nominal');
CREATE TYPE public.promo_channel AS ENUM ('pos', 'online', 'all');

-- Promos table
CREATE TABLE public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  code text NOT NULL,
  description text,
  type promo_type NOT NULL DEFAULT 'percent',
  value numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  channel promo_channel NOT NULL DEFAULT 'all',
  usage_limit int,
  usage_count int NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);
CREATE INDEX idx_promos_shop ON public.promos(shop_id);
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY promos_owner_all ON public.promos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = promos.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = promos.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY promos_staff_read ON public.promos FOR SELECT TO authenticated
  USING (is_active = true AND EXISTS (
    SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid()
      AND r.role IN ('cashier','barista') AND r.shop_id = promos.shop_id
  ));

CREATE POLICY promos_public_read ON public.promos FOR SELECT TO public
  USING (is_active = true AND channel IN ('online','all') AND EXISTS (
    SELECT 1 FROM coffee_shops s WHERE s.id = promos.shop_id AND s.is_active = true
  ));

CREATE TRIGGER promos_touch BEFORE UPDATE ON public.promos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Promo redemptions
CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL,
  order_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  user_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_promo_red_promo ON public.promo_redemptions(promo_id);
CREATE INDEX idx_promo_red_order ON public.promo_redemptions(order_id);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promo_red_owner_read ON public.promo_redemptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = promo_redemptions.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY promo_red_self_read ON public.promo_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY promo_red_insert ON public.promo_redemptions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (
      has_outlet_access(auth.uid(), o.outlet_id) OR o.customer_user_id = auth.uid()
    ))
  );

-- Loyalty settings
CREATE TABLE public.loyalty_settings (
  shop_id uuid PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT false,
  rupiah_per_point numeric NOT NULL DEFAULT 10000,
  point_value numeric NOT NULL DEFAULT 1000,
  min_redeem_points int NOT NULL DEFAULT 10,
  max_redeem_percent int NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY loyalty_settings_owner_all ON public.loyalty_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = loyalty_settings.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = loyalty_settings.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY loyalty_settings_public_read ON public.loyalty_settings FOR SELECT TO public
  USING (is_active = true AND EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = loyalty_settings.shop_id AND s.is_active = true));

CREATE TRIGGER loyalty_settings_touch BEFORE UPDATE ON public.loyalty_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Loyalty points (saldo per customer per shop)
CREATE TABLE public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  balance int NOT NULL DEFAULT 0,
  total_earned int NOT NULL DEFAULT 0,
  total_redeemed int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY loyalty_points_self_read ON public.loyalty_points FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY loyalty_points_owner_read ON public.loyalty_points FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = loyalty_points.shop_id AND s.owner_id = auth.uid()));

-- Loyalty ledger
CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid,
  delta int NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_ledger_user ON public.loyalty_ledger(user_id, shop_id);
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY loyalty_ledger_self_read ON public.loyalty_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY loyalty_ledger_owner_read ON public.loyalty_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = loyalty_ledger.shop_id AND s.owner_id = auth.uid()));

-- Add columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_id uuid,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS points_earned int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed int NOT NULL DEFAULT 0;

-- Validate promo function
CREATE OR REPLACE FUNCTION public.validate_promo(_shop_id uuid, _code text, _subtotal numeric, _channel text)
RETURNS TABLE(promo_id uuid, code text, discount numeric, error text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p promos%ROWTYPE;
  d numeric := 0;
BEGIN
  SELECT * INTO p FROM promos
  WHERE shop_id = _shop_id AND lower(code) = lower(_code) AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, _code, 0::numeric, 'Kode promo tidak ditemukan';
    RETURN;
  END IF;

  IF p.starts_at IS NOT NULL AND p.starts_at > now() THEN
    RETURN QUERY SELECT p.id, p.code, 0::numeric, 'Promo belum berlaku';
    RETURN;
  END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at < now() THEN
    RETURN QUERY SELECT p.id, p.code, 0::numeric, 'Promo sudah expired';
    RETURN;
  END IF;
  IF p.channel <> 'all' AND p.channel::text <> _channel THEN
    RETURN QUERY SELECT p.id, p.code, 0::numeric, 'Promo tidak berlaku untuk channel ini';
    RETURN;
  END IF;
  IF _subtotal < p.min_order THEN
    RETURN QUERY SELECT p.id, p.code, 0::numeric, 'Belum mencapai minimum order';
    RETURN;
  END IF;
  IF p.usage_limit IS NOT NULL AND p.usage_count >= p.usage_limit THEN
    RETURN QUERY SELECT p.id, p.code, 0::numeric, 'Kuota promo habis';
    RETURN;
  END IF;

  IF p.type = 'percent' THEN
    d := round(_subtotal * p.value / 100);
    IF p.max_discount IS NOT NULL AND d > p.max_discount THEN
      d := p.max_discount;
    END IF;
  ELSE
    d := p.value;
  END IF;
  IF d > _subtotal THEN d := _subtotal; END IF;

  RETURN QUERY SELECT p.id, p.code, d, NULL::text;
END;
$$;