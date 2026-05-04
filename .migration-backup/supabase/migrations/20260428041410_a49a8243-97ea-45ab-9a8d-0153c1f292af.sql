-- ============== INGREDIENTS ==============
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredients_shop ON public.ingredients(shop_id);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY ingredients_owner_all ON public.ingredients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = ingredients.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = ingredients.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY ingredients_staff_read ON public.ingredients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('cashier','barista') AND r.shop_id = ingredients.shop_id));

CREATE TRIGGER trg_ingredients_updated BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== RECIPES (BOM) ==============
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, ingredient_id)
);

CREATE INDEX idx_recipes_menu ON public.recipes(menu_item_id);
CREATE INDEX idx_recipes_ingredient ON public.recipes(ingredient_id);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipes_owner_all ON public.recipes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM menu_items m JOIN coffee_shops s ON s.id = m.shop_id WHERE m.id = recipes.menu_item_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM menu_items m JOIN coffee_shops s ON s.id = m.shop_id WHERE m.id = recipes.menu_item_id AND s.owner_id = auth.uid()));

CREATE POLICY recipes_staff_read ON public.recipes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM menu_items m
    JOIN user_roles r ON r.shop_id = m.shop_id
    WHERE m.id = recipes.menu_item_id AND r.user_id = auth.uid() AND r.role IN ('cashier','barista')
  ));

-- ============== STOCK MOVEMENTS ==============
CREATE TYPE public.stock_movement_type AS ENUM ('purchase','adjustment','sale','waste');

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  type stock_movement_type NOT NULL,
  quantity numeric NOT NULL,
  unit_cost numeric,
  note text,
  order_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_shop ON public.stock_movements(shop_id, created_at DESC);
CREATE INDEX idx_stock_movements_ingredient ON public.stock_movements(ingredient_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_movements_owner_all ON public.stock_movements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = stock_movements.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = stock_movements.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY stock_movements_staff_read ON public.stock_movements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('cashier','barista') AND r.shop_id = stock_movements.shop_id));

-- ============== MENU TRACK STOCK FLAG ==============
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false;

-- ============== AUTO-DECREMENT TRIGGER ==============
-- When stock_movements row is inserted, update ingredients.current_stock
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type IN ('purchase','adjustment') THEN
    UPDATE public.ingredients SET current_stock = current_stock + NEW.quantity WHERE id = NEW.ingredient_id;
  ELSIF NEW.type IN ('sale','waste') THEN
    UPDATE public.ingredients SET current_stock = current_stock - NEW.quantity WHERE id = NEW.ingredient_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- When order_item inserted for a tracked menu, generate stock movements per recipe ingredient
CREATE OR REPLACE FUNCTION public.consume_stock_for_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track boolean;
  v_shop uuid;
  rec RECORD;
BEGIN
  IF NEW.menu_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.track_stock, m.shop_id INTO v_track, v_shop
  FROM public.menu_items m WHERE m.id = NEW.menu_item_id;

  IF NOT COALESCE(v_track, false) THEN
    RETURN NEW;
  END IF;

  FOR rec IN
    SELECT ingredient_id, quantity FROM public.recipes WHERE menu_item_id = NEW.menu_item_id
  LOOP
    INSERT INTO public.stock_movements (shop_id, ingredient_id, type, quantity, note, order_id)
    VALUES (v_shop, rec.ingredient_id, 'sale', rec.quantity * NEW.quantity, 'Auto from order', NEW.order_id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_consume_stock_for_order_item AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.consume_stock_for_order_item();
