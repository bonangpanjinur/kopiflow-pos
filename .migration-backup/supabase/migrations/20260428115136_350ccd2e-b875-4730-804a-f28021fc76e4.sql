
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS qris_image_url text,
  ADD COLUMN IF NOT EXISTS qris_merchant_name text,
  ADD COLUMN IF NOT EXISTS payment_methods_enabled text[] NOT NULL DEFAULT ARRAY['cash','qris']::text[];

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid','awaiting_verification','paid','refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

UPDATE public.orders
   SET payment_status = 'paid', paid_at = COALESCE(paid_at, updated_at)
 WHERE status = 'completed' AND payment_status = 'unpaid';

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment_proofs_customer_insert" ON storage.objects;
CREATE POLICY "payment_proofs_customer_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[2]
        AND o.shop_id::text = (storage.foldername(name))[1]
        AND o.customer_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payment_proofs_customer_read" ON storage.objects;
CREATE POLICY "payment_proofs_customer_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[2]
        AND o.customer_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payment_proofs_owner_read" ON storage.objects;
CREATE POLICY "payment_proofs_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payment_proofs_owner_delete" ON storage.objects;
CREATE POLICY "payment_proofs_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "orders_customer_pay_update" ON public.orders;
CREATE POLICY "orders_customer_pay_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (customer_user_id = auth.uid() AND channel = 'online' AND status::text = 'pending')
  WITH CHECK (customer_user_id = auth.uid() AND channel = 'online');
