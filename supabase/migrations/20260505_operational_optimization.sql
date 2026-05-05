-- Phase 3: Operational Optimization

-- 1. KDS Station Routing
-- Add kds_station to categories
ALTER TABLE public.categories
ADD COLUMN kds_station VARCHAR(50) DEFAULT 'general';

-- 2. Multi-Printer Support
-- Create printers table
CREATE TABLE public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'thermal', -- thermal, inkjet, etc.
  connection_type VARCHAR(50) NOT NULL DEFAULT 'browser', -- browser, network, bluetooth
  address VARCHAR(255), -- IP address or device name
  paper_size VARCHAR(10) DEFAULT '58', -- 58, 80
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_printers_shop_id ON public.printers(shop_id);
CREATE INDEX idx_printers_outlet_id ON public.printers(outlet_id);

-- Add printer_id to categories for routing
ALTER TABLE public.categories
ADD COLUMN printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL;

-- 3. Advanced Permissions
-- We already have staff_permissions, let's enhance it if needed.
-- For now, we will use the existing structure but define more granular module names.
-- Example module names: 'pos.void', 'pos.refund', 'inventory.manage', 'settings.general', 'reports.view'

-- Enable RLS for printers
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view printers of their shops"
  ON public.printers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = printers.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can insert printers to their shops"
  ON public.printers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can update printers of their shops"
  ON public.printers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = printers.shop_id
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

CREATE POLICY "users can delete printers of their shops"
  ON public.printers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = printers.shop_id
      AND owner_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER printers_touch
  BEFORE UPDATE ON public.printers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
