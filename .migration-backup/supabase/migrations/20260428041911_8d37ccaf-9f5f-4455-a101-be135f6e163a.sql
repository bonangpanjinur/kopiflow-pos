-- ============== ADD MANAGER ROLE ==============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- ============== STAFF INVITATIONS ==============
CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  outlet_id uuid,
  email text NOT NULL,
  role app_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_invitations_shop ON public.staff_invitations(shop_id);
CREATE INDEX idx_staff_invitations_email ON public.staff_invitations(email);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Owner: full access
CREATE POLICY staff_inv_owner_all ON public.staff_invitations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = staff_invitations.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = staff_invitations.shop_id AND s.owner_id = auth.uid()));

-- Anyone (anon + auth) can read by token (for invite-accept page)
CREATE POLICY staff_inv_token_read ON public.staff_invitations
  FOR SELECT TO anon, authenticated
  USING (accepted_at IS NULL AND expires_at > now());

-- Authenticated user can mark as accepted (only their own email)
CREATE POLICY staff_inv_accept ON public.staff_invitations
  FOR UPDATE TO authenticated
  USING (accepted_at IS NULL AND expires_at > now() AND lower(email) = lower((auth.jwt()->>'email')))
  WITH CHECK (accepted_by = auth.uid());

-- ============== SHIFTS (weekly schedule) ==============
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  user_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun..6=Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_shop ON public.shifts(shop_id);
CREATE INDEX idx_shifts_user ON public.shifts(user_id);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_owner_all ON public.shifts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = shifts.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = shifts.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY shifts_self_read ON public.shifts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== ATTENDANCES ==============
CREATE TABLE public.attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  outlet_id uuid NOT NULL,
  user_id uuid NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  duration_minutes integer,
  business_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta'))::date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendances_shop ON public.attendances(shop_id, business_date DESC);
CREATE INDEX idx_attendances_user ON public.attendances(user_id, business_date DESC);

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendances_owner_all ON public.attendances
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM businesses s WHERE s.id = attendances.shop_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses s WHERE s.id = attendances.shop_id AND s.owner_id = auth.uid()));

-- Self: insert (clock-in) and update own row (clock-out), select own
CREATE POLICY attendances_self_select ON public.attendances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY attendances_self_insert ON public.attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND has_outlet_access(auth.uid(), outlet_id)
  );

CREATE POLICY attendances_self_update ON public.attendances
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_attendances_updated BEFORE UPDATE ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto duration on clock-out
CREATE OR REPLACE FUNCTION public.calc_attendance_duration()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in))::int / 60);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_attendance_duration BEFORE INSERT OR UPDATE ON public.attendances
  FOR EACH ROW EXECUTE FUNCTION public.calc_attendance_duration();

-- ============== ACCEPT INVITATION FN ==============
-- Atomic accept: mark invitation accepted and create user_roles row
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv staff_invitations%ROWTYPE;
  v_email text;
BEGIN
  v_email := lower(coalesce((auth.jwt()->>'email'), ''));
  IF v_email = '' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_inv FROM public.staff_invitations
  WHERE token = _token AND accepted_at IS NULL AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired';
  END IF;

  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  -- Create role row (idempotent on user_id+role+shop)
  INSERT INTO public.user_roles (user_id, role, shop_id, outlet_id)
  VALUES (auth.uid(), v_inv.role, v_inv.shop_id, v_inv.outlet_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.staff_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('shop_id', v_inv.shop_id, 'role', v_inv.role);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(text) TO authenticated;

-- ============== STAFF DIRECTORY VIEW HELPER ==============
-- Owner needs to read members of their shop. user_roles.select_own only allows self.
-- Add policy: owners can read user_roles within their shop.
CREATE POLICY user_roles_owner_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM businesses s WHERE s.id = user_roles.shop_id AND s.owner_id = auth.uid()));

CREATE POLICY user_roles_owner_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM businesses s WHERE s.id = user_roles.shop_id AND s.owner_id = auth.uid()));

-- Owner: view profiles of staff in their shops (so we can show name/avatar)
CREATE POLICY profiles_owner_read_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN public.businesses s ON s.id = r.shop_id
    WHERE r.user_id = profiles.id AND s.owner_id = auth.uid()
  ));
