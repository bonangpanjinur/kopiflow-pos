
-- 1. Add new statuses to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'delivering';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. Add courier_id column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_id uuid;

CREATE INDEX IF NOT EXISTS orders_courier_id_idx ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS orders_shop_status_idx ON public.orders(shop_id, status);

-- 3. Allow assigned courier to read their orders
CREATE POLICY orders_courier_read ON public.orders
  FOR SELECT TO authenticated
  USING (
    courier_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.couriers c
      WHERE c.id = orders.courier_id AND c.user_id = auth.uid()
    )
  );

-- 4. Allow assigned courier to update status of their orders
CREATE POLICY orders_courier_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    courier_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.couriers c
      WHERE c.id = orders.courier_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    courier_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.couriers c
      WHERE c.id = orders.courier_id AND c.user_id = auth.uid()
    )
  );

-- 5. Public tracking function (limited fields, by id only)
CREATE OR REPLACE FUNCTION public.get_order_tracking(_order_id uuid)
RETURNS TABLE (
  id uuid,
  order_no text,
  status order_status,
  fulfillment fulfillment_type,
  channel order_channel,
  total numeric,
  delivery_fee numeric,
  delivery_address text,
  customer_name text,
  created_at timestamptz,
  updated_at timestamptz,
  shop_name text,
  shop_slug text,
  courier_name text,
  courier_phone text,
  courier_plate text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.order_no, o.status, o.fulfillment, o.channel,
    o.total, o.delivery_fee, o.delivery_address, o.customer_name,
    o.created_at, o.updated_at,
    s.name as shop_name, s.slug as shop_slug,
    c.name as courier_name, c.phone as courier_phone, c.plate_number as courier_plate
  FROM public.orders o
  JOIN public.coffee_shops s ON s.id = o.shop_id
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  WHERE o.id = _order_id
    AND o.channel = 'online'
$$;

GRANT EXECUTE ON FUNCTION public.get_order_tracking(uuid) TO anon, authenticated;
