-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_owner_all ON public.suppliers
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = suppliers.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = suppliers.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY suppliers_staff_read ON public.suppliers
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles r
  WHERE r.user_id = auth.uid()
    AND r.role IN ('cashier','barista')
    AND r.shop_id = suppliers.shop_id
));

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PURCHASE ORDERS ============
CREATE TYPE public.po_status AS ENUM ('draft','ordered','received','cancelled');

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_no text NOT NULL,
  status public.po_status NOT NULL DEFAULT 'draft',
  order_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  expected_date date,
  received_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_owner_all ON public.purchase_orders
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = purchase_orders.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = purchase_orders.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY po_staff_read ON public.purchase_orders
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles r
  WHERE r.user_id = auth.uid()
    AND r.role IN ('cashier','barista')
    AND r.shop_id = purchase_orders.shop_id
));

CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_po_shop ON public.purchase_orders(shop_id, status);

-- ============ PURCHASE ORDER ITEMS ============
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  received_qty numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY poi_owner_all ON public.purchase_order_items
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM purchase_orders po
  JOIN coffee_shops s ON s.id = po.shop_id
  WHERE po.id = purchase_order_items.po_id AND s.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM purchase_orders po
  JOIN coffee_shops s ON s.id = po.shop_id
  WHERE po.id = purchase_order_items.po_id AND s.owner_id = auth.uid()
));

CREATE POLICY poi_staff_read ON public.purchase_order_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM purchase_orders po
  JOIN user_roles r ON r.shop_id = po.shop_id
  WHERE po.id = purchase_order_items.po_id
    AND r.user_id = auth.uid()
    AND r.role IN ('cashier','barista')
));

CREATE INDEX idx_poi_po ON public.purchase_order_items(po_id);

-- ============ MENU HPP VIEW ============
CREATE OR REPLACE VIEW public.menu_hpp_view AS
SELECT
  m.id AS menu_item_id,
  m.shop_id,
  m.name,
  m.price,
  COALESCE(SUM(r.quantity * i.cost_per_unit), 0) AS hpp,
  m.price - COALESCE(SUM(r.quantity * i.cost_per_unit), 0) AS margin,
  CASE WHEN m.price > 0
    THEN ROUND(((m.price - COALESCE(SUM(r.quantity * i.cost_per_unit), 0)) / m.price) * 100, 2)
    ELSE 0 END AS margin_percent
FROM public.menu_items m
LEFT JOIN public.recipes r ON r.menu_item_id = m.id
LEFT JOIN public.ingredients i ON i.id = r.ingredient_id
GROUP BY m.id, m.shop_id, m.name, m.price;

-- ============ RECEIVE PO RPC ============
CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_po purchase_orders%ROWTYPE;
  rec RECORD;
  v_old_stock numeric;
  v_old_cost numeric;
  v_new_cost numeric;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_po FROM purchase_orders WHERE id = _po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'po_not_found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = v_po.shop_id AND s.owner_id = v_caller) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_po.status = 'received' THEN RAISE EXCEPTION 'already_received'; END IF;

  FOR rec IN
    SELECT ingredient_id, quantity, unit_cost FROM purchase_order_items WHERE po_id = _po_id
  LOOP
    -- Insert stock movement (purchase) — trigger will increment ingredient stock
    INSERT INTO stock_movements (shop_id, ingredient_id, type, quantity, unit_cost, note, created_by)
    VALUES (v_po.shop_id, rec.ingredient_id, 'purchase', rec.quantity, rec.unit_cost,
            'PO ' || v_po.po_no, v_caller);

    -- Weighted moving average cost update
    SELECT current_stock, cost_per_unit INTO v_old_stock, v_old_cost
      FROM ingredients WHERE id = rec.ingredient_id;
    -- v_old_stock here is post-increment (trigger already applied)
    IF v_old_stock > 0 THEN
      v_new_cost := ROUND(((COALESCE(v_old_cost,0) * (v_old_stock - rec.quantity)) + (rec.unit_cost * rec.quantity)) / v_old_stock, 4);
      UPDATE ingredients SET cost_per_unit = GREATEST(v_new_cost, 0), updated_at = now()
        WHERE id = rec.ingredient_id;
    END IF;

    UPDATE purchase_order_items SET received_qty = rec.quantity WHERE po_id = _po_id AND ingredient_id = rec.ingredient_id;
  END LOOP;

  UPDATE purchase_orders
    SET status = 'received', received_date = (now() AT TIME ZONE 'Asia/Jakarta')::date, updated_at = now()
    WHERE id = _po_id;
END;
$$;