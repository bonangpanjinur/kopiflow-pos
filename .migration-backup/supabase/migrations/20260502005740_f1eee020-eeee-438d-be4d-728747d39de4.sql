CREATE TABLE IF NOT EXISTS public.parked_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Cart',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parked_carts_outlet ON public.parked_carts(outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parked_carts_shop ON public.parked_carts(shop_id);

ALTER TABLE public.parked_carts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_belongs_to_shop(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coffee_shops WHERE id = _shop_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.staff_permissions WHERE shop_id = _shop_id AND user_id = _user_id
  );
$$;

CREATE POLICY "Shop members can view parked carts"
  ON public.parked_carts FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_shop(auth.uid(), shop_id));

CREATE POLICY "Shop members can insert parked carts"
  ON public.parked_carts FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_shop(auth.uid(), shop_id));

CREATE POLICY "Shop members can update parked carts"
  ON public.parked_carts FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_shop(auth.uid(), shop_id));

CREATE POLICY "Shop members can delete parked carts"
  ON public.parked_carts FOR DELETE
  TO authenticated
  USING (public.user_belongs_to_shop(auth.uid(), shop_id));

CREATE TRIGGER trg_parked_carts_updated_at
  BEFORE UPDATE ON public.parked_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.parked_carts;