
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'courier';
EXCEPTION WHEN others THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  user_id uuid,
  name text NOT NULL,
  phone text NOT NULL,
  plate_number text,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couriers_owner_all" ON public.couriers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coffee_shops s WHERE s.id = couriers.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coffee_shops s WHERE s.id = couriers.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "couriers_self_read" ON public.couriers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_couriers_updated
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_couriers_shop ON public.couriers(shop_id);
CREATE INDEX IF NOT EXISTS idx_couriers_user ON public.couriers(user_id);
