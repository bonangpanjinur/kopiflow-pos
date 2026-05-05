-- Helper: check if user is staff at outlet (or shop-wide)
CREATE OR REPLACE FUNCTION public.has_outlet_access(_user_id uuid, _outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.outlets o
    JOIN public.businesses s ON s.id = o.shop_id
    WHERE o.id = _outlet_id
      AND (
        s.owner_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.user_roles r
          WHERE r.user_id = _user_id
            AND r.role IN ('cashier','barista','owner')
            AND (r.outlet_id = o.id OR r.shop_id = s.id)
        )
      )
  )
$$;

-- open_bills
CREATE TABLE public.open_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Cart',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_open_bills_outlet ON public.open_bills(outlet_id, updated_at DESC);
ALTER TABLE public.open_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY open_bills_access ON public.open_bills
  FOR ALL TO authenticated
  USING (public.has_outlet_access(auth.uid(), outlet_id))
  WITH CHECK (public.has_outlet_access(auth.uid(), outlet_id));

CREATE TRIGGER open_bills_touch BEFORE UPDATE ON public.open_bills
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Order status enum
CREATE TYPE public.order_status AS ENUM ('completed','voided','refunded');
CREATE TYPE public.payment_method AS ENUM ('cash','qris');

-- orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  order_no text NOT NULL,
  business_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  customer_name text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL,
  amount_tendered numeric(12,2),
  change_due numeric(12,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'completed',
  cashier_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, business_date, order_no)
);
CREATE INDEX idx_orders_outlet_date ON public.orders(outlet_id, business_date DESC, created_at DESC);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_access ON public.orders
  FOR ALL TO authenticated
  USING (public.has_outlet_access(auth.uid(), outlet_id))
  WITH CHECK (public.has_outlet_access(auth.uid(), outlet_id));

CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- order_items (snapshot)
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal numeric(12,2) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_items_access ON public.order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.has_outlet_access(auth.uid(), o.outlet_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.has_outlet_access(auth.uid(), o.outlet_id)));

-- Daily order number generator (per outlet)
CREATE OR REPLACE FUNCTION public.next_order_no(_outlet_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bd date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  n int;
BEGIN
  SELECT COUNT(*) + 1 INTO n
  FROM public.orders
  WHERE outlet_id = _outlet_id AND business_date = bd;
  RETURN LPAD(n::text, 3, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_order_no(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_order_no(uuid) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.open_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;