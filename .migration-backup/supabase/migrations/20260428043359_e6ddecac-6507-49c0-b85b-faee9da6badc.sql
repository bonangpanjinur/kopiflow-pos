
DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'preparing';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready';
EXCEPTION WHEN others THEN null; END $$;
