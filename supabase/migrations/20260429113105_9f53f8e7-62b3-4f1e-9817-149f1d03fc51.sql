-- Fix incorrect RLS expressions on storage.objects for payment-proofs
-- Previous policies used storage.foldername(s.name) which references the join alias incorrectly.
DROP POLICY IF EXISTS "payment_proofs_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_owner_write" ON storage.objects;

CREATE POLICY "payment_proofs_owner_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'payment-proofs' AND (
    EXISTS (
      SELECT 1 FROM public.businesses s
      WHERE s.owner_id = auth.uid()
        AND s.id::text = (storage.foldername(objects.name))[1]
    )
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

CREATE POLICY "payment_proofs_owner_write" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'payment-proofs' AND EXISTS (
    SELECT 1 FROM public.businesses s
    WHERE s.owner_id = auth.uid()
      AND s.id::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "payment_proofs_owner_delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'payment-proofs' AND EXISTS (
    SELECT 1 FROM public.businesses s
    WHERE s.owner_id = auth.uid()
      AND s.id::text = (storage.foldername(objects.name))[1]
  )
);

-- Allow shop owner to cancel their own pending invoice (not after review)
CREATE POLICY "plan_invoices_owner_cancel" ON public.plan_invoices
FOR UPDATE
USING (
  status = 'pending' AND EXISTS (
    SELECT 1 FROM public.businesses s WHERE s.id = plan_invoices.shop_id AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  status IN ('pending','cancelled') AND EXISTS (
    SELECT 1 FROM public.businesses s WHERE s.id = plan_invoices.shop_id AND s.owner_id = auth.uid()
  )
);