-- 1) Auto-create customer_profiles on signup when raw_user_meta_data->>'is_customer'='true'
CREATE OR REPLACE FUNCTION public.handle_new_customer_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'is_customer') = 'true' THEN
    INSERT INTO public.customer_profiles (user_id, display_name, email, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
      NEW.email,
      NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_signup();

-- 2) Add prep_minutes & address_lat/lng default to coffee_shops for ETA
ALTER TABLE public.coffee_shops
  ADD COLUMN IF NOT EXISTS prep_minutes integer NOT NULL DEFAULT 20;

-- 3) Storage RLS for payment-proofs (path = `{order_id}/...`)
DO $$ BEGIN
  -- Allow customer (authenticated) to upload bukti bayar for orders they own.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='payment_proofs_customer_insert'
  ) THEN
    CREATE POLICY payment_proofs_customer_insert
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'payment-proofs'
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id::text = (storage.foldername(name))[1]
            AND o.customer_user_id = auth.uid()
        )
      );
  END IF;

  -- Allow customer to read their own bukti
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='payment_proofs_customer_read'
  ) THEN
    CREATE POLICY payment_proofs_customer_read
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'payment-proofs'
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id::text = (storage.foldername(name))[1]
            AND o.customer_user_id = auth.uid()
        )
      );
  END IF;

  -- Allow shop owner & staff to read bukti for orders in their outlet
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname='payment_proofs_owner_read'
  ) THEN
    CREATE POLICY payment_proofs_owner_read
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'payment-proofs'
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id::text = (storage.foldername(name))[1]
            AND public.has_outlet_access(auth.uid(), o.outlet_id)
        )
      );
  END IF;
END $$;
