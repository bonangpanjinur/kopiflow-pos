-- =========================
-- STOCK OPNAME
-- =========================
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_opname_id uuid NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL,
  system_stock numeric NOT NULL DEFAULT 0,
  actual_stock numeric NOT NULL DEFAULT 0,
  adjustment numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_opnames_shop ON public.stock_opnames(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_opname ON public.stock_opname_items(stock_opname_id);

ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_opnames_owner_all ON public.stock_opnames
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = stock_opnames.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = stock_opnames.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY stock_opnames_staff_read ON public.stock_opnames
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM user_roles r
  WHERE r.user_id = auth.uid()
    AND r.shop_id = stock_opnames.shop_id
    AND r.role = ANY (ARRAY['cashier'::app_role, 'barista'::app_role])
));

CREATE POLICY stock_opname_items_owner_all ON public.stock_opname_items
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM stock_opnames o JOIN businesses s ON s.id = o.shop_id
  WHERE o.id = stock_opname_items.stock_opname_id AND s.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM stock_opnames o JOIN businesses s ON s.id = o.shop_id
  WHERE o.id = stock_opname_items.stock_opname_id AND s.owner_id = auth.uid()
));

CREATE POLICY stock_opname_items_staff_read ON public.stock_opname_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM stock_opnames o
  JOIN user_roles r ON r.shop_id = o.shop_id
  WHERE o.id = stock_opname_items.stock_opname_id
    AND r.user_id = auth.uid()
    AND r.role = ANY (ARRAY['cashier'::app_role, 'barista'::app_role])
));

CREATE TRIGGER update_stock_opnames_updated_at
BEFORE UPDATE ON public.stock_opnames
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- MENU REVIEWS
-- =========================
CREATE TABLE IF NOT EXISTS public.menu_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, menu_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_reviews_menu ON public.menu_reviews(menu_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_reviews_shop ON public.menu_reviews(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_reviews_user ON public.menu_reviews(user_id);

ALTER TABLE public.menu_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY menu_reviews_public_read ON public.menu_reviews
FOR SELECT TO public
USING (is_visible = true);

CREATE POLICY menu_reviews_self_insert ON public.menu_reviews
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = menu_reviews.order_id
      AND o.customer_user_id = auth.uid()
      AND o.status = 'completed'::order_status
  )
);

CREATE POLICY menu_reviews_self_update ON public.menu_reviews
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY menu_reviews_self_delete ON public.menu_reviews
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY menu_reviews_owner_all ON public.menu_reviews
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_reviews.shop_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_reviews.shop_id AND s.owner_id = auth.uid()));

CREATE TRIGGER update_menu_reviews_updated_at
BEFORE UPDATE ON public.menu_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();