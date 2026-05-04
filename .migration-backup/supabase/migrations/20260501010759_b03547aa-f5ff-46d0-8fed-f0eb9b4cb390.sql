
-- Create updated_at function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- 1. shop_customers
-- ============================================
CREATE TABLE public.shop_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  phone text,
  email text,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  first_order_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}',
  segment text DEFAULT 'new',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);

ALTER TABLE public.shop_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_customers_owner_all" ON public.shop_customers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = shop_customers.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = shop_customers.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "shop_customers_self_read" ON public.shop_customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_shop_customers_shop ON public.shop_customers(shop_id);
CREATE INDEX idx_shop_customers_user ON public.shop_customers(user_id);
CREATE INDEX idx_shop_customers_segment ON public.shop_customers(shop_id, segment);

-- ============================================
-- 2. customer_favorites
-- ============================================
CREATE TABLE public.customer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_id, menu_item_id)
);

ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_favorites_self_all" ON public.customer_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 3. customer_segments
-- ============================================
CREATE TABLE public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  criteria jsonb NOT NULL DEFAULT '{}',
  is_auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_segments_owner_all" ON public.customer_segments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = customer_segments.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = customer_segments.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY "customer_segments_super_admin_read" ON public.customer_segments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================
-- 4. marketing_campaigns
-- ============================================
CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  template text NOT NULL DEFAULT '',
  audience_segment text,
  audience_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_campaigns_owner_all" ON public.marketing_campaigns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = marketing_campaigns.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = marketing_campaigns.shop_id AND s.owner_id = auth.uid()));

-- ============================================
-- 5. campaign_recipients
-- ============================================
CREATE TABLE public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_recipients_owner_all" ON public.campaign_recipients
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing_campaigns mc
    JOIN coffee_shops s ON s.id = mc.shop_id
    WHERE mc.id = campaign_recipients.campaign_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM marketing_campaigns mc
    JOIN coffee_shops s ON s.id = mc.shop_id
    WHERE mc.id = campaign_recipients.campaign_id AND s.owner_id = auth.uid()
  ));

-- ============================================
-- 6. Trigger: auto-update shop_customers on order
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_shop_customer_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_user_id IS NOT NULL AND NEW.status IN ('completed', 'delivered') THEN
    INSERT INTO public.shop_customers (shop_id, user_id, display_name, phone, total_orders, total_spent, last_order_at, first_order_at)
    VALUES (
      NEW.shop_id,
      NEW.customer_user_id,
      COALESCE(NEW.customer_name, ''),
      NEW.customer_phone,
      1,
      NEW.total,
      NEW.created_at,
      NEW.created_at
    )
    ON CONFLICT (shop_id, user_id) DO UPDATE SET
      display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), shop_customers.display_name),
      phone = COALESCE(EXCLUDED.phone, shop_customers.phone),
      total_orders = shop_customers.total_orders + 1,
      total_spent = shop_customers.total_spent + EXCLUDED.total_spent,
      last_order_at = GREATEST(shop_customers.last_order_at, EXCLUDED.last_order_at),
      first_order_at = LEAST(shop_customers.first_order_at, EXCLUDED.first_order_at),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_upsert_shop_customer
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.upsert_shop_customer_on_order();

-- ============================================
-- 7. updated_at triggers
-- ============================================
CREATE TRIGGER update_shop_customers_updated_at
  BEFORE UPDATE ON public.shop_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_segments_updated_at
  BEFORE UPDATE ON public.customer_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
