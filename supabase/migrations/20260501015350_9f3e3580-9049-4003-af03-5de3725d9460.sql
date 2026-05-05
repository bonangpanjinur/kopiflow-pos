
-- Add allowed_modules to staff_invitations
ALTER TABLE public.staff_invitations
ADD COLUMN IF NOT EXISTS allowed_modules text[] DEFAULT NULL;

-- Add allowed_modules to shifts (persists after accept)
-- We'll use a separate staff_permissions table instead for cleaner design
CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'cashier',
  allowed_modules text[] DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, user_id)
);

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

-- Owner can manage staff permissions for their shop
CREATE POLICY "Owner manages staff permissions"
ON public.staff_permissions
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.coffee_shops WHERE id = shop_id AND owner_id = auth.uid())
);

-- Staff can read their own permissions
CREATE POLICY "Staff reads own permissions"
ON public.staff_permissions
FOR SELECT
USING (user_id = auth.uid());

-- Receipt customization columns
ALTER TABLE public.coffee_shops
ADD COLUMN IF NOT EXISTS receipt_header text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS receipt_footer text DEFAULT NULL;
