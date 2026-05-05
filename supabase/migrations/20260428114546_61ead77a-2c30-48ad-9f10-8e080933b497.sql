
ALTER TABLE public.coffee_shops
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS open_hours jsonb NOT NULL DEFAULT '{"mon":{"open":"08:00","close":"22:00","closed":false},"tue":{"open":"08:00","close":"22:00","closed":false},"wed":{"open":"08:00","close":"22:00","closed":false},"thu":{"open":"08:00","close":"22:00","closed":false},"fri":{"open":"08:00","close":"22:00","closed":false},"sat":{"open":"08:00","close":"22:00","closed":false},"sun":{"open":"08:00","close":"22:00","closed":false}}'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "shop_logos_public_read" ON storage.objects;
CREATE POLICY "shop_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'shop-logos');

DROP POLICY IF EXISTS "shop_logos_owner_write" ON storage.objects;
CREATE POLICY "shop_logos_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-logos'
    AND EXISTS (
      SELECT 1 FROM public.coffee_shops s
      WHERE s.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  );

DROP POLICY IF EXISTS "shop_logos_owner_update" ON storage.objects;
CREATE POLICY "shop_logos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shop-logos'
    AND EXISTS (
      SELECT 1 FROM public.coffee_shops s
      WHERE s.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  );

DROP POLICY IF EXISTS "shop_logos_owner_delete" ON storage.objects;
CREATE POLICY "shop_logos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'shop-logos'
    AND EXISTS (
      SELECT 1 FROM public.coffee_shops s
      WHERE s.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  );
