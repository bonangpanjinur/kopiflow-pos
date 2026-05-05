-- Atomic courier claim & courier earnings view
-- Prevents race condition when two couriers try to claim the same order.

CREATE OR REPLACE FUNCTION public.assign_courier_atomic(_order_id uuid, _courier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order orders%ROWTYPE;
  v_courier couriers%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_courier FROM couriers WHERE id = _courier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'courier_not_found'; END IF;

  -- Caller must be the courier's user OR have outlet access (owner/cashier assigning)
  IF NOT (
    v_courier.user_id = v_caller
    OR EXISTS (SELECT 1 FROM businesses s WHERE s.id = v_courier.shop_id AND s.owner_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Lock the row to prevent double-claim
  SELECT * INTO v_order FROM orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  IF v_order.shop_id <> v_courier.shop_id THEN
    RAISE EXCEPTION 'shop_mismatch';
  END IF;

  IF v_order.courier_id IS NOT NULL AND v_order.courier_id <> _courier_id THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  IF v_order.status NOT IN ('ready', 'preparing') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE orders
    SET courier_id = _courier_id,
        updated_at = now()
    WHERE id = _order_id;

  RETURN jsonb_build_object('order_id', _order_id, 'courier_id', _courier_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_courier_atomic(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.assign_courier_atomic(uuid, uuid) TO authenticated;

-- Helper: list "available" delivery orders (no courier assigned yet) for a courier's shop
CREATE OR REPLACE FUNCTION public.list_available_delivery_orders(_courier_id uuid)
RETURNS TABLE(
  id uuid, order_no text, status order_status, total numeric, delivery_fee numeric,
  delivery_address text, customer_name text, customer_phone text, note text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.order_no, o.status, o.total, o.delivery_fee,
         o.delivery_address, o.customer_name, o.customer_phone, o.note, o.created_at
  FROM orders o
  JOIN couriers c ON c.id = _courier_id
  WHERE o.shop_id = c.shop_id
    AND o.courier_id IS NULL
    AND o.fulfillment = 'delivery'
    AND o.status IN ('ready', 'preparing')
    AND (
      c.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM businesses s WHERE s.id = c.shop_id AND s.owner_id = auth.uid())
    )
  ORDER BY o.created_at ASC
  LIMIT 50
$$;

REVOKE EXECUTE ON FUNCTION public.list_available_delivery_orders(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_available_delivery_orders(uuid) TO authenticated;
