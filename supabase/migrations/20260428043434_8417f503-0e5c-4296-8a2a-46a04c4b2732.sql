
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_profiles_self_all" ON public.customer_profiles
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_customer_profiles_updated
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Rumah',
  recipient_name text NOT NULL,
  phone text NOT NULL,
  address_line text NOT NULL,
  notes text,
  latitude numeric,
  longitude numeric,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_addresses_self_all" ON public.customer_addresses
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_customer_addresses_updated
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$ BEGIN
  CREATE TYPE public.order_channel AS ENUM ('pos','online');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.fulfillment_type AS ENUM ('dine_in','pickup','delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS channel public.order_channel NOT NULL DEFAULT 'pos',
  ADD COLUMN IF NOT EXISTS fulfillment public.fulfillment_type NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS customer_user_id uuid,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

ALTER TABLE public.orders ALTER COLUMN cashier_id DROP NOT NULL;

CREATE POLICY "orders_customer_insert_online" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    channel = 'online'
    AND customer_user_id = auth.uid()
    AND status::text = 'pending'
  );

CREATE POLICY "orders_customer_self_read" ON public.orders
  FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY "order_items_customer_insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_user_id = auth.uid()
        AND o.status::text = 'pending'
    )
  );

CREATE POLICY "order_items_customer_self_read" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_customer_user ON public.orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel_status ON public.orders(channel, status);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON public.customer_addresses(user_id);
