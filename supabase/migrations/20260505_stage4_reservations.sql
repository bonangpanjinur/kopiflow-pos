-- Stage 4: Reservations System

-- 1. Create ENUM for reservation status
CREATE TYPE public.reservation_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show'
);

-- 2. Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  special_requests TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancelled_reason VARCHAR(255)
);

CREATE INDEX idx_reservations_shop_id ON public.reservations(shop_id);
CREATE INDEX idx_reservations_outlet_id ON public.reservations(outlet_id);
CREATE INDEX idx_reservations_table_id ON public.reservations(table_id);
CREATE INDEX idx_reservations_customer_user_id ON public.reservations(customer_user_id);
CREATE INDEX idx_reservations_date_time ON public.reservations(reservation_date, reservation_time);
CREATE INDEX idx_reservations_status ON public.reservations(status);

-- 3. Create reservation_slots table (for availability management)
CREATE TABLE public.reservation_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  available_tables INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(outlet_id, date, time)
);

CREATE INDEX idx_reservation_slots_outlet_id ON public.reservation_slots(outlet_id);
CREATE INDEX idx_reservation_slots_date_time ON public.reservation_slots(date, time);

-- 4. Create reservation_settings table
CREATE TABLE public.reservation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  advance_booking_days INTEGER NOT NULL DEFAULT 30,
  min_party_size INTEGER NOT NULL DEFAULT 1,
  max_party_size INTEGER NOT NULL DEFAULT 100,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 60,
  slots_per_hour INTEGER NOT NULL DEFAULT 4,
  opening_time TIME NOT NULL DEFAULT '10:00',
  closing_time TIME NOT NULL DEFAULT '22:00',
  allow_online_booking BOOLEAN NOT NULL DEFAULT true,
  require_deposit BOOLEAN NOT NULL DEFAULT false,
  deposit_percent NUMERIC(5,2) DEFAULT 0,
  auto_confirm_booking BOOLEAN NOT NULL DEFAULT false,
  cancellation_policy_hours INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(outlet_id)
);

CREATE INDEX idx_reservation_settings_outlet_id ON public.reservation_settings(outlet_id);

-- 5. Add reservation_id to orders table
ALTER TABLE public.orders
ADD COLUMN reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_reservation_id ON public.orders(reservation_id);

-- 6. Enable RLS for reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view reservations of their shops"
  ON public.reservations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = reservations.shop_id
      AND owner_id = auth.uid()
    )
    OR customer_user_id = auth.uid()
  );

CREATE POLICY "users can insert reservations to their shops"
  ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
    OR customer_user_id = auth.uid()
  );

CREATE POLICY "users can update reservations of their shops"
  ON public.reservations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = reservations.shop_id
      AND owner_id = auth.uid()
    )
    OR customer_user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
    OR customer_user_id = auth.uid()
  );

CREATE POLICY "users can delete reservations of their shops"
  ON public.reservations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = reservations.shop_id
      AND owner_id = auth.uid()
    )
  );

-- 7. Enable RLS for reservation_slots
ALTER TABLE public.reservation_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view reservation_slots of their shops"
  ON public.reservation_slots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = reservation_slots.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage reservation_slots of their shops"
  ON public.reservation_slots FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = reservation_slots.shop_id
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

-- 8. Enable RLS for reservation_settings
ALTER TABLE public.reservation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view reservation_settings of their shops"
  ON public.reservation_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = reservation_settings.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage reservation_settings of their shops"
  ON public.reservation_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = reservation_settings.shop_id
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

-- 9. Triggers for updated_at
CREATE TRIGGER reservations_touch
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER reservation_slots_touch
  BEFORE UPDATE ON public.reservation_slots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER reservation_settings_touch
  BEFORE UPDATE ON public.reservation_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10. Create function to check table availability
CREATE OR REPLACE FUNCTION public.check_table_availability(
  _outlet_id UUID,
  _reservation_date DATE,
  _reservation_time TIME,
  _party_size INTEGER,
  _exclude_reservation_id UUID DEFAULT NULL
)
RETURNS TABLE (available_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::INTEGER
  FROM public.tables t
  WHERE t.outlet_id = _outlet_id
    AND t.capacity >= _party_size
    AND t.status IN ('available', 'reserved')
    AND NOT EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.table_id = t.id
        AND r.reservation_date = _reservation_date
        AND r.reservation_time = _reservation_time
        AND r.status IN ('pending', 'confirmed')
        AND (COALESCE(_exclude_reservation_id, '00000000-0000-0000-0000-000000000000'::UUID) != r.id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. Create function to auto-generate reservation slots
CREATE OR REPLACE FUNCTION public.generate_reservation_slots(
  _outlet_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS void AS $$
DECLARE
  _current_date DATE;
  _current_time TIME;
  _settings RECORD;
  _slot_count INTEGER;
BEGIN
  SELECT * INTO _settings FROM public.reservation_settings
  WHERE outlet_id = _outlet_id AND is_enabled = true;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  _current_date := _start_date;
  WHILE _current_date <= _end_date LOOP
    _current_time := _settings.opening_time;
    WHILE _current_time < _settings.closing_time LOOP
      -- Calculate available tables for this slot
      SELECT COUNT(*)::INTEGER INTO _slot_count
      FROM public.tables t
      WHERE t.outlet_id = _outlet_id
        AND t.status IN ('available', 'reserved');

      INSERT INTO public.reservation_slots (shop_id, outlet_id, date, time, available_tables)
      VALUES (
        (SELECT shop_id FROM public.outlets WHERE id = _outlet_id),
        _outlet_id,
        _current_date,
        _current_time,
        _slot_count
      )
      ON CONFLICT (outlet_id, date, time) DO UPDATE
      SET available_tables = _slot_count, updated_at = now();

      _current_time := _current_time + (INTERVAL '1 minute' * (60 / _settings.slots_per_hour));
    END LOOP;
    _current_date := _current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
