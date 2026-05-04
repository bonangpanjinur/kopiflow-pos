
CREATE OR REPLACE FUNCTION public.apply_loyalty_post_order(
  _shop_id uuid,
  _user_id uuid,
  _order_id uuid,
  _earned int,
  _redeemed int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_caller uuid := auth.uid();
BEGIN
  IF _user_id IS NULL OR (_earned <= 0 AND _redeemed <= 0) THEN
    RETURN;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order.shop_id <> _shop_id THEN
    RAISE EXCEPTION 'shop_mismatch';
  END IF;

  -- Authorization: caller must be the customer of this order, or have outlet access (POS)
  IF NOT (
    (v_order.customer_user_id IS NOT NULL AND v_order.customer_user_id = v_caller AND v_caller = _user_id)
    OR public.has_outlet_access(v_caller, v_order.outlet_id)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Upsert balance
  INSERT INTO public.loyalty_points (shop_id, user_id, balance, total_earned, total_redeemed)
  VALUES (_shop_id, _user_id, GREATEST(_earned - _redeemed, 0), GREATEST(_earned, 0), GREATEST(_redeemed, 0))
  ON CONFLICT (shop_id, user_id) DO UPDATE
    SET balance = public.loyalty_points.balance + (_earned - _redeemed),
        total_earned = public.loyalty_points.total_earned + GREATEST(_earned, 0),
        total_redeemed = public.loyalty_points.total_redeemed + GREATEST(_redeemed, 0),
        updated_at = now();

  IF _earned > 0 THEN
    INSERT INTO public.loyalty_ledger (shop_id, user_id, order_id, delta, reason)
    VALUES (_shop_id, _user_id, _order_id, _earned, 'earn');
  END IF;
  IF _redeemed > 0 THEN
    INSERT INTO public.loyalty_ledger (shop_id, user_id, order_id, delta, reason)
    VALUES (_shop_id, _user_id, _order_id, -_redeemed, 'redeem');
  END IF;
END;
$$;

-- Need unique constraint for ON CONFLICT to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loyalty_points_shop_user_unique'
  ) THEN
    ALTER TABLE public.loyalty_points
      ADD CONSTRAINT loyalty_points_shop_user_unique UNIQUE (shop_id, user_id);
  END IF;
END $$;
