-- ============== STOCK OPNAMES ==============
CREATE TABLE public.stock_opnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed', -- 'draft', 'completed'
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz DEFAULT now()
);

CREATE TABLE public.stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_opname_id uuid NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  system_stock numeric NOT NULL,
  actual_stock numeric NOT NULL,
  adjustment numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_opnames_shop ON public.stock_opnames(shop_id, created_at DESC);
CREATE INDEX idx_stock_opname_items_opname ON public.stock_opname_items(stock_opname_id);

ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_opnames_owner_all ON public.stock_opnames
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = stock_opnames.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = stock_opnames.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY stock_opname_items_owner_all ON public.stock_opname_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM stock_opnames o JOIN businesses s ON s.id = o.shop_id WHERE o.id = stock_opname_items.stock_opname_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM stock_opnames o JOIN businesses s ON s.id = o.shop_id WHERE o.id = stock_opname_items.stock_opname_id AND s.owner_id = auth.uid()));

-- Staff can read
CREATE POLICY stock_opnames_staff_read ON public.stock_opnames
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('cashier','barista','manager') AND r.shop_id = stock_opnames.shop_id));

CREATE POLICY stock_opname_items_staff_read ON public.stock_opname_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM stock_opnames o JOIN user_roles r ON r.shop_id = o.shop_id WHERE o.id = stock_opname_items.stock_opname_id AND r.user_id = auth.uid() AND r.role IN ('cashier','barista','manager')));
