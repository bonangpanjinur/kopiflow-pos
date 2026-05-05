
-- ============ BATCH 4: MONEY ============

-- Enums
DO $$ BEGIN
  CREATE TYPE public.shift_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cash_movement_type AS ENUM ('in','out','sale','refund','opening','closing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== cash_shifts =====
CREATE TABLE IF NOT EXISTS public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_cash numeric NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_at timestamptz,
  closing_cash numeric,
  expected_cash numeric,
  variance numeric,
  status shift_status NOT NULL DEFAULT 'open',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_outlet_status ON public.cash_shifts(outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_shop ON public.cash_shifts(shop_id);

ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_shifts_owner_all ON public.cash_shifts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = cash_shifts.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = cash_shifts.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY cash_shifts_staff_read ON public.cash_shifts FOR SELECT TO authenticated
  USING (has_outlet_access(auth.uid(), outlet_id));

CREATE POLICY cash_shifts_staff_insert ON public.cash_shifts FOR INSERT TO authenticated
  WITH CHECK (has_outlet_access(auth.uid(), outlet_id) AND opened_by = auth.uid());

CREATE POLICY cash_shifts_staff_update ON public.cash_shifts FOR UPDATE TO authenticated
  USING (has_outlet_access(auth.uid(), outlet_id))
  WITH CHECK (has_outlet_access(auth.uid(), outlet_id));

CREATE TRIGGER cash_shifts_touch BEFORE UPDATE ON public.cash_shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== cash_movements =====
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.cash_shifts(id) ON DELETE CASCADE,
  type cash_movement_type NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  order_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON public.cash_movements(shift_id);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_movements_owner_all ON public.cash_movements FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cash_shifts cs JOIN coffee_shops s ON s.id = cs.shop_id
    WHERE cs.id = cash_movements.shift_id AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM cash_shifts cs JOIN coffee_shops s ON s.id = cs.shop_id
    WHERE cs.id = cash_movements.shift_id AND s.owner_id = auth.uid()
  ));

CREATE POLICY cash_movements_staff_read ON public.cash_movements FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cash_shifts cs WHERE cs.id = cash_movements.shift_id AND has_outlet_access(auth.uid(), cs.outlet_id)
  ));

CREATE POLICY cash_movements_staff_insert ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM cash_shifts cs WHERE cs.id = cash_movements.shift_id AND has_outlet_access(auth.uid(), cs.outlet_id)
  ));

-- ===== refunds =====
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  refund_method text NOT NULL DEFAULT 'cash',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_shop ON public.refunds(shop_id);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY refunds_owner_all ON public.refunds FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = refunds.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coffee_shops s WHERE s.id = refunds.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY refunds_staff_read ON public.refunds FOR SELECT TO authenticated
  USING (has_outlet_access(auth.uid(), outlet_id));

-- ===== ALTER orders =====
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shift_id uuid,
  ADD COLUMN IF NOT EXISTS tip_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_split jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_shift ON public.orders(shift_id);

-- ===== ALTER coffee_shops =====
ALTER TABLE public.coffee_shops
  ADD COLUMN IF NOT EXISTS tax_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false;

-- ===== RPC: open_shift =====
CREATE OR REPLACE FUNCTION public.open_shift(_outlet_id uuid, _opening_cash numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_shop uuid;
  v_existing uuid;
  v_shift_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_outlet_access(v_caller, _outlet_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT shop_id INTO v_shop FROM public.outlets WHERE id = _outlet_id;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'outlet_not_found'; END IF;

  SELECT id INTO v_existing FROM public.cash_shifts
   WHERE outlet_id = _outlet_id AND status = 'open' LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.cash_shifts (shop_id, outlet_id, opened_by, opening_cash)
  VALUES (v_shop, _outlet_id, v_caller, COALESCE(_opening_cash, 0))
  RETURNING id INTO v_shift_id;

  INSERT INTO public.cash_movements (shift_id, type, amount, note, created_by)
  VALUES (v_shift_id, 'opening', COALESCE(_opening_cash, 0), 'Modal awal', v_caller);

  RETURN v_shift_id;
END;
$$;

-- ===== RPC: close_shift =====
CREATE OR REPLACE FUNCTION public.close_shift(_shift_id uuid, _closing_cash numeric, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_shift cash_shifts%ROWTYPE;
  v_cash_sales numeric := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
  v_refunds numeric := 0;
  v_expected numeric;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_shift FROM public.cash_shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'shift_not_found'; END IF;
  IF v_shift.status = 'closed' THEN RAISE EXCEPTION 'shift_already_closed'; END IF;
  IF NOT public.has_outlet_access(v_caller, v_shift.outlet_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Sum cash sales linked to this shift
  SELECT COALESCE(SUM(
    CASE
      WHEN o.payment_method = 'cash' THEN o.total
      WHEN jsonb_array_length(o.payment_split) > 0 THEN COALESCE((
        SELECT SUM((elem->>'amount')::numeric)
        FROM jsonb_array_elements(o.payment_split) elem
        WHERE elem->>'method' = 'cash'
      ), 0)
      ELSE 0
    END
  ), 0) INTO v_cash_sales
  FROM public.orders o
  WHERE o.shift_id = _shift_id AND o.status NOT IN ('voided','cancelled');

  SELECT COALESCE(SUM(amount),0) INTO v_cash_in
    FROM public.cash_movements WHERE shift_id = _shift_id AND type = 'in';
  SELECT COALESCE(SUM(amount),0) INTO v_cash_out
    FROM public.cash_movements WHERE shift_id = _shift_id AND type = 'out';
  SELECT COALESCE(SUM(amount),0) INTO v_refunds
    FROM public.cash_movements WHERE shift_id = _shift_id AND type = 'refund';

  v_expected := v_shift.opening_cash + v_cash_sales + v_cash_in - v_cash_out - v_refunds;

  UPDATE public.cash_shifts
    SET status = 'closed',
        closed_by = v_caller,
        closed_at = now(),
        closing_cash = COALESCE(_closing_cash, 0),
        expected_cash = v_expected,
        variance = COALESCE(_closing_cash, 0) - v_expected,
        note = COALESCE(_note, note),
        updated_at = now()
    WHERE id = _shift_id;

  INSERT INTO public.cash_movements (shift_id, type, amount, note, created_by)
  VALUES (_shift_id, 'closing', COALESCE(_closing_cash, 0), 'Tutup shift', v_caller);

  RETURN jsonb_build_object(
    'shift_id', _shift_id,
    'opening_cash', v_shift.opening_cash,
    'cash_sales', v_cash_sales,
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'refunds', v_refunds,
    'expected_cash', v_expected,
    'closing_cash', COALESCE(_closing_cash, 0),
    'variance', COALESCE(_closing_cash, 0) - v_expected
  );
END;
$$;

-- ===== RPC: refund_order =====
CREATE OR REPLACE FUNCTION public.refund_order(
  _order_id uuid,
  _amount numeric,
  _reason text DEFAULT NULL,
  _method text DEFAULT 'cash'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order orders%ROWTYPE;
  v_refund_id uuid;
  v_open_shift uuid;
  v_already_refunded numeric;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF NOT public.has_outlet_access(v_caller, v_order.outlet_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_already_refunded
    FROM public.refunds WHERE order_id = _order_id;
  IF v_already_refunded + _amount > v_order.total THEN
    RAISE EXCEPTION 'amount_exceeds_total';
  END IF;

  INSERT INTO public.refunds (order_id, shop_id, outlet_id, amount, reason, refund_method, created_by)
  VALUES (_order_id, v_order.shop_id, v_order.outlet_id, _amount, _reason, COALESCE(_method,'cash'), v_caller)
  RETURNING id INTO v_refund_id;

  -- If cash refund and there's an open shift, log cash movement
  IF COALESCE(_method,'cash') = 'cash' THEN
    SELECT id INTO v_open_shift FROM public.cash_shifts
      WHERE outlet_id = v_order.outlet_id AND status = 'open' LIMIT 1;
    IF v_open_shift IS NOT NULL THEN
      INSERT INTO public.cash_movements (shift_id, type, amount, note, order_id, created_by)
      VALUES (v_open_shift, 'refund', _amount, COALESCE('Refund: ' || _reason, 'Refund'), _order_id, v_caller);
    END IF;
  END IF;

  -- Update order payment_status
  IF v_already_refunded + _amount >= v_order.total THEN
    UPDATE public.orders SET payment_status = 'refunded',
      note = COALESCE(note || ' | ', '') || 'REFUND ' || _amount || ': ' || COALESCE(_reason,''),
      updated_at = now()
    WHERE id = _order_id;
  ELSE
    UPDATE public.orders SET
      note = COALESCE(note || ' | ', '') || 'PARTIAL REFUND ' || _amount || ': ' || COALESCE(_reason,''),
      updated_at = now()
    WHERE id = _order_id;
  END IF;

  RETURN v_refund_id;
END;
$$;
