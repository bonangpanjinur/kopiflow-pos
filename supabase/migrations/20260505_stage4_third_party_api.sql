-- Stage 4: Third-Party Integration API

-- 1. Create api_keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 10000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_shop_id ON public.api_keys(shop_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);

-- 2. Create api_usage table
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_api_key_id ON public.api_usage(api_key_id);
CREATE INDEX idx_api_usage_shop_id ON public.api_usage(shop_id);
CREATE INDEX idx_api_usage_created_at ON public.api_usage(created_at);

-- 3. Create third_party_integrations table
CREATE TABLE public.third_party_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- grabfood, gofood, accounting_system, etc.
  provider_account_id VARCHAR(255),
  provider_account_name VARCHAR(255),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(50) DEFAULT 'idle', -- idle, syncing, error
  sync_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, provider, outlet_id)
);

CREATE INDEX idx_third_party_integrations_shop_id ON public.third_party_integrations(shop_id);
CREATE INDEX idx_third_party_integrations_provider ON public.third_party_integrations(provider);

-- 4. Create integration_webhooks table
CREATE TABLE public.integration_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.third_party_integrations(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- order.created, order.updated, order.cancelled, etc.
  webhook_url VARCHAR(500) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_webhooks_integration_id ON public.integration_webhooks(integration_id);
CREATE INDEX idx_integration_webhooks_event_type ON public.integration_webhooks(event_type);

-- 5. Create webhook_events table
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.integration_webhooks(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.third_party_integrations(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, sent, failed, delivered
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_webhook_id ON public.webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at);

-- 6. Create integration_mappings table (for field mapping between systems)
CREATE TABLE public.integration_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.third_party_integrations(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  source_field VARCHAR(255) NOT NULL,
  target_field VARCHAR(255) NOT NULL,
  mapping_type VARCHAR(50) NOT NULL DEFAULT 'direct', -- direct, transform, custom_function
  mapping_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_mappings_integration_id ON public.integration_mappings(integration_id);

-- 7. Enable RLS for API tables
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.third_party_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_mappings ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for api_keys
CREATE POLICY "users can view api_keys of their shops"
  ON public.api_keys FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = api_keys.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage api_keys of their shops"
  ON public.api_keys FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = api_keys.shop_id
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

-- 9. RLS Policies for api_usage
CREATE POLICY "users can view api_usage of their shops"
  ON public.api_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = api_usage.shop_id
      AND owner_id = auth.uid()
    )
  );

-- 10. RLS Policies for third_party_integrations
CREATE POLICY "users can view third_party_integrations of their shops"
  ON public.third_party_integrations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = third_party_integrations.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage third_party_integrations of their shops"
  ON public.third_party_integrations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = third_party_integrations.shop_id
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

-- 11. RLS Policies for integration_webhooks
CREATE POLICY "users can view integration_webhooks of their shops"
  ON public.integration_webhooks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = integration_webhooks.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage integration_webhooks of their shops"
  ON public.integration_webhooks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = integration_webhooks.shop_id
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

-- 12. RLS Policies for webhook_events
CREATE POLICY "users can view webhook_events of their shops"
  ON public.webhook_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.third_party_integrations tpi
      JOIN public.coffee_shops cs ON cs.id = tpi.shop_id
      WHERE tpi.id = webhook_events.integration_id
      AND cs.owner_id = auth.uid()
    )
  );

-- 13. RLS Policies for integration_mappings
CREATE POLICY "users can view integration_mappings of their shops"
  ON public.integration_mappings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = integration_mappings.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage integration_mappings of their shops"
  ON public.integration_mappings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = integration_mappings.shop_id
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

-- 14. Triggers for updated_at
CREATE TRIGGER api_keys_touch
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER third_party_integrations_touch
  BEFORE UPDATE ON public.third_party_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER integration_webhooks_touch
  BEFORE UPDATE ON public.integration_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER webhook_events_touch
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER integration_mappings_touch
  BEFORE UPDATE ON public.integration_mappings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 15. Function to record API usage
CREATE OR REPLACE FUNCTION public.record_api_usage(
  _api_key_id UUID,
  _endpoint VARCHAR,
  _method VARCHAR,
  _status_code INTEGER,
  _response_time_ms INTEGER,
  _error_message TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.api_usage (api_key_id, shop_id, endpoint, method, status_code, response_time_ms, error_message)
  SELECT _api_key_id, shop_id, _endpoint, _method, _status_code, _response_time_ms, _error_message
  FROM public.api_keys
  WHERE id = _api_key_id;

  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE id = _api_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 16. Function to check API rate limit
CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  _api_key_id UUID
)
RETURNS TABLE (allowed BOOLEAN, current_minute_count INTEGER, current_day_count INTEGER) AS $$
DECLARE
  _rate_limit_per_minute INTEGER;
  _rate_limit_per_day INTEGER;
  _minute_count INTEGER;
  _day_count INTEGER;
BEGIN
  SELECT rate_limit_per_minute, rate_limit_per_day
  INTO _rate_limit_per_minute, _rate_limit_per_day
  FROM public.api_keys
  WHERE id = _api_key_id;

  SELECT COUNT(*)::INTEGER
  INTO _minute_count
  FROM public.api_usage
  WHERE api_key_id = _api_key_id
    AND created_at > now() - INTERVAL '1 minute';

  SELECT COUNT(*)::INTEGER
  INTO _day_count
  FROM public.api_usage
  WHERE api_key_id = _api_key_id
    AND created_at > now() - INTERVAL '1 day';

  RETURN QUERY
  SELECT
    (_minute_count < _rate_limit_per_minute AND _day_count < _rate_limit_per_day)::BOOLEAN,
    _minute_count,
    _day_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
