-- Audit log for branding (logo, address, phone, name) changes
CREATE TABLE public.branding_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_branding_audit_shop ON public.branding_audit(shop_id, created_at DESC);

ALTER TABLE public.branding_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branding_audit_owner_read"
  ON public.branding_audit
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.businesses s
    WHERE s.id = branding_audit.shop_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY "branding_audit_owner_insert"
  ON public.branding_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.id = branding_audit.shop_id AND s.owner_id = auth.uid()
    )
  );