
-- ============================================
-- 1. Option Groups (Size, Sugar Level, etc.)
-- ============================================
CREATE TABLE public.menu_item_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  name text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  max_select integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_option_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "option_groups_owner_all" ON public.menu_item_option_groups
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_item_option_groups.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_item_option_groups.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "option_groups_public_read" ON public.menu_item_option_groups
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_item_option_groups.shop_id AND s.is_active = true));

CREATE POLICY "option_groups_staff_read" ON public.menu_item_option_groups
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('cashier', 'barista') AND r.shop_id = menu_item_option_groups.shop_id));

CREATE INDEX idx_option_groups_menu_item ON public.menu_item_option_groups(menu_item_id);

-- ============================================
-- 2. Individual Options (Small, Medium, Large)
-- ============================================
CREATE TABLE public.menu_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.menu_item_option_groups(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  name text NOT NULL,
  price_adjustment numeric NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "options_owner_all" ON public.menu_item_options
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_item_options.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_item_options.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "options_public_read" ON public.menu_item_options
  FOR SELECT TO public
  USING (is_available = true AND EXISTS (SELECT 1 FROM businesses s WHERE s.id = menu_item_options.shop_id AND s.is_active = true));

CREATE POLICY "options_staff_read" ON public.menu_item_options
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('cashier', 'barista') AND r.shop_id = menu_item_options.shop_id));

CREATE INDEX idx_options_group ON public.menu_item_options(group_id);

-- Triggers
CREATE TRIGGER update_option_groups_updated_at
  BEFORE UPDATE ON public.menu_item_option_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_options_updated_at
  BEFORE UPDATE ON public.menu_item_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
