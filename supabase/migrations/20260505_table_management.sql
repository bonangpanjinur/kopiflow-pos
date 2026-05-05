-- Create ENUM for table_status
CREATE TYPE public.table_status AS ENUM (
  'available',
  'occupied',
  'dirty',
  'reserved'
);

-- Create ENUM for table_shape
CREATE TYPE public.table_shape AS ENUM (
  'rectangle',
  'circle'
);

-- Create tables table
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  status public.table_status NOT NULL DEFAULT 'available',
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 1,
  height FLOAT NOT NULL DEFAULT 1,
  shape public.table_shape NOT NULL DEFAULT 'rectangle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tables_shop_id ON public.tables(shop_id);
CREATE INDEX idx_tables_outlet_id ON public.tables(outlet_id);

-- Create table_maps table
CREATE TABLE public.table_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  layout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_maps_shop_id ON public.table_maps(shop_id);
CREATE INDEX idx_table_maps_outlet_id ON public.table_maps(outlet_id);

-- Add table_id to orders table
ALTER TABLE public.orders
ADD COLUMN table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_table_id ON public.orders(table_id);

-- Add table_id to open_bills table
ALTER TABLE public.open_bills
ADD COLUMN table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL;

CREATE INDEX idx_open_bills_table_id ON public.open_bills(table_id);

-- Enable RLS for tables
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tables
CREATE POLICY "users can view tables of their shops"
  ON public.tables FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = tables.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can insert tables to their shops"
  ON public.tables FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can update tables of their shops"
  ON public.tables FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = tables.shop_id
      AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can delete tables of their shops"
  ON public.tables FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = tables.shop_id
      AND owner_id = auth.uid()
    )
  );

-- Enable RLS for table_maps
ALTER TABLE public.table_maps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for table_maps
CREATE POLICY "users can view table_maps of their shops"
  ON public.table_maps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = table_maps.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can insert table_maps to their shops"
  ON public.table_maps FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can update table_maps of their shops"
  ON public.table_maps FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = table_maps.shop_id
      AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can delete table_maps of their shops"
  ON public.table_maps FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = table_maps.shop_id
      AND owner_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER tables_touch
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER table_maps_touch
  BEFORE UPDATE ON public.table_maps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
