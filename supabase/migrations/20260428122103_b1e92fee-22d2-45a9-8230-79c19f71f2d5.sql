
CREATE OR REPLACE FUNCTION public.void_order(_order_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_caller uuid := auth.uid();
  rec RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF NOT public.has_outlet_access(v_caller, v_order.outlet_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_order.status IN ('voided','cancelled') THEN
    RETURN;
  END IF;

  -- Reverse stock for tracked menu items
  FOR rec IN
    SELECT oi.menu_item_id, oi.quantity AS sold_qty, r.ingredient_id, r.quantity AS recipe_qty, m.shop_id, m.track_stock
    FROM public.order_items oi
    JOIN public.menu_items m ON m.id = oi.menu_item_id
    JOIN public.recipes r ON r.menu_item_id = m.id
    WHERE oi.order_id = _order_id AND m.track_stock = true
  LOOP
    INSERT INTO public.stock_movements (shop_id, ingredient_id, type, quantity, note, order_id, created_by)
    VALUES (rec.shop_id, rec.ingredient_id, 'adjustment', rec.recipe_qty * rec.sold_qty,
            COALESCE('Void order: ' || _reason, 'Void order'),
            _order_id, v_caller);
  END LOOP;

  -- Reverse loyalty points if any (best effort)
  IF v_order.customer_user_id IS NOT NULL AND (v_order.points_earned > 0 OR v_order.points_redeemed > 0) THEN
    INSERT INTO public.loyalty_points (shop_id, user_id, balance, total_earned, total_redeemed)
    VALUES (v_order.shop_id, v_order.customer_user_id,
            v_order.points_redeemed - v_order.points_earned, 0, 0)
    ON CONFLICT (shop_id, user_id) DO UPDATE
      SET balance = public.loyalty_points.balance + (v_order.points_redeemed - v_order.points_earned),
          updated_at = now();

    INSERT INTO public.loyalty_ledger (shop_id, user_id, order_id, delta, reason)
    VALUES (v_order.shop_id, v_order.customer_user_id, _order_id,
            v_order.points_redeemed - v_order.points_earned, 'void');
  END IF;

  UPDATE public.orders
  SET status = 'voided',
      payment_status = 'refunded',
      note = COALESCE(note || ' | ', '') || 'VOID: ' || COALESCE(_reason, ''),
      updated_at = now()
  WHERE id = _order_id;
END;
$$;
