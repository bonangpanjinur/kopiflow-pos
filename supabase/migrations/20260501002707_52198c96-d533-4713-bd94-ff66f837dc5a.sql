-- Shop backups: snapshot per toko
CREATE TABLE IF NOT EXISTS public.shop_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
  file_path text,                          -- storage path inside bucket 'shop-backups'
  size_bytes bigint,
  includes jsonb NOT NULL DEFAULT '[]'::jsonb, -- list of tables included
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS shop_backups_shop_idx ON public.shop_backups(shop_id, created_at DESC);

ALTER TABLE public.shop_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_backups_owner_read"
  ON public.shop_backups FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = shop_backups.shop_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "shop_backups_owner_insert"
  ON public.shop_backups FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = shop_backups.shop_id AND s.owner_id = auth.uid())
  );

CREATE POLICY "shop_backups_super_admin_write"
  ON public.shop_backups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Backup schedules
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  shop_id uuid PRIMARY KEY,
  frequency text NOT NULL DEFAULT 'weekly', -- daily | weekly | monthly | off
  retention_days integer NOT NULL DEFAULT 30,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now() + interval '1 day',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_schedules_owner_all"
  ON public.backup_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = backup_schedules.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = backup_schedules.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "backup_schedules_super_admin_read"
  ON public.backup_schedules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
  VALUES ('shop-backups', 'shop-backups', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('customer-exports', 'customer-exports', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: shop-backups (path layout: <shop_id>/<filename>)
CREATE POLICY "shop_backups_bucket_owner_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'shop-backups'
    AND (
      EXISTS (
        SELECT 1 FROM coffee_shops s
        WHERE s.id::text = (storage.foldername(name))[1]
          AND s.owner_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "shop_backups_bucket_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-backups'
    AND EXISTS (
      SELECT 1 FROM coffee_shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "shop_backups_bucket_super_admin_write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'shop-backups' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'shop-backups' AND public.has_role(auth.uid(), 'super_admin'));

-- customer-exports bucket policies (path layout: <user_id>/<filename>)
CREATE POLICY "customer_exports_bucket_self_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'customer-exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "customer_exports_bucket_self_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'customer-exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Updated_at trigger
CREATE TRIGGER backup_schedules_touch_updated_at
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
