-- Restrict billing_settings reads to super_admin only (cron_secret is sensitive)
DROP POLICY IF EXISTS billing_settings_read_all ON public.billing_settings;

CREATE POLICY billing_settings_super_admin_read
ON public.billing_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Public-safe view exposing only non-sensitive payment instruction fields
CREATE OR REPLACE VIEW public.billing_settings_public
WITH (security_invoker = true) AS
SELECT id, bank_name, account_no, account_name, instructions, qris_image_url, updated_at
FROM public.billing_settings;

-- The view runs as invoker; grant table-level SELECT on the underlying columns
-- via a SECURITY DEFINER function pattern is overkill here — instead expose
-- the view through grants and bypass RLS by using a stable function.
-- Simpler: re-add a column-limited RLS read policy for the safe columns is not
-- possible (RLS is row-level). Use a SECURITY DEFINER function for public read.

CREATE OR REPLACE FUNCTION public.get_billing_settings_public()
RETURNS TABLE (
  bank_name text,
  account_no text,
  account_name text,
  instructions text,
  qris_image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bank_name, account_no, account_name, instructions, qris_image_url
  FROM public.billing_settings
  WHERE id = 1
$$;

GRANT EXECUTE ON FUNCTION public.get_billing_settings_public() TO anon, authenticated;

-- Drop the view (not needed; function is cleaner and avoids view RLS pitfalls)
DROP VIEW IF EXISTS public.billing_settings_public;