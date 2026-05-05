
DO $$ BEGIN
  CREATE TYPE public.delivery_mode AS ENUM ('flat','zone');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.delivery_settings (
  shop_id uuid PRIMARY KEY,
  mode public.delivery_mode NOT NULL DEFAULT 'flat',
  base_fee numeric NOT NULL DEFAULT 0,
  free_above numeric,
  min_order numeric NOT NULL DEFAULT 0,
  pickup_enabled boolean NOT NULL DEFAULT true,
  delivery_enabled boolean NOT NULL DEFAULT true,
  open_time time,
  close_time time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_settings_owner_all" ON public.delivery_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = delivery_settings.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = delivery_settings.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "delivery_settings_public_read" ON public.delivery_settings
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = delivery_settings.shop_id AND s.is_active = true));

CREATE TRIGGER trg_delivery_settings_updated
  BEFORE UPDATE ON public.delivery_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  fee numeric NOT NULL DEFAULT 0,
  area_note text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_zones_owner_all" ON public.delivery_zones
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = delivery_zones.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = delivery_zones.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "delivery_zones_public_read" ON public.delivery_zones
  FOR SELECT TO public
  USING (is_active = true AND EXISTS (SELECT 1 FROM public.businesses s WHERE s.id = delivery_zones.shop_id AND s.is_active = true));

CREATE TRIGGER trg_delivery_zones_updated
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_delivery_zones_shop ON public.delivery_zones(shop_id);

-- Add zone reference to orders for delivery channel
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid;
