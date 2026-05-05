-- Categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_shop ON public.categories(shop_id, sort_order);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_owner_all ON public.categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = categories.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = categories.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY categories_public_read ON public.categories
  FOR SELECT TO public
  USING (is_active = true AND EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = categories.shop_id AND s.is_active = true));

CREATE POLICY categories_staff_read ON public.categories
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('cashier','barista') AND r.shop_id = categories.shop_id));

CREATE TRIGGER categories_touch BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Menu items table
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_items_shop ON public.menu_items(shop_id, category_id, sort_order);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY menu_items_owner_all ON public.menu_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = menu_items.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = menu_items.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY menu_items_public_read ON public.menu_items
  FOR SELECT TO public
  USING (is_available = true AND EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = menu_items.shop_id AND s.is_active = true));

CREATE POLICY menu_items_staff_read ON public.menu_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('cashier','barista') AND r.shop_id = menu_items.shop_id));

CREATE TRIGGER menu_items_touch BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for menu images (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "menu_images_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'menu-images');

CREATE POLICY "menu_images_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "menu_images_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "menu_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );