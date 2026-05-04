CREATE OR REPLACE FUNCTION public.increment_promo_usage(_promo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.promos SET usage_count = usage_count + 1 WHERE id = _promo_id;
$$;