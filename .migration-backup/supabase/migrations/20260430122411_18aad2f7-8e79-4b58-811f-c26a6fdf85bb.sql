
-- ============= Catalog tables =============

CREATE TABLE public.features (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.themes (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  preview_image_url text,
  component_id text NOT NULL,
  tier_hint text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_features (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.features(key) ON DELETE CASCADE,
  requires_min_months integer NOT NULL DEFAULT 0,
  limit_value integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE public.plan_themes (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  theme_key text NOT NULL REFERENCES public.themes(key) ON DELETE CASCADE,
  requires_min_months integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, theme_key)
);

-- ============= coffee_shops additions =============

ALTER TABLE public.coffee_shops
  ADD COLUMN IF NOT EXISTS active_theme_key text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz;

UPDATE public.coffee_shops SET active_theme_key = 'classic' WHERE active_theme_key IS NULL;
UPDATE public.coffee_shops SET plan_started_at = COALESCE(plan_started_at, now() - interval '30 days')
  WHERE plan = 'pro' AND plan_started_at IS NULL;

-- ============= Touch triggers =============
CREATE TRIGGER trg_features_touch BEFORE UPDATE ON public.features FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_themes_touch BEFORE UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= RLS =============
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY features_public_read ON public.features FOR SELECT TO public USING (true);
CREATE POLICY features_super_admin_write ON public.features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY themes_public_read ON public.themes FOR SELECT TO public USING (true);
CREATE POLICY themes_super_admin_write ON public.themes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY plan_features_public_read ON public.plan_features FOR SELECT TO public USING (true);
CREATE POLICY plan_features_super_admin_write ON public.plan_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY plan_themes_public_read ON public.plan_themes FOR SELECT TO public USING (true);
CREATE POLICY plan_themes_super_admin_write ON public.plan_themes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============= Seed catalog =============

INSERT INTO public.features (key, name, description, category, sort_order) VALUES
  ('online_orders', 'Pemesanan Online', 'Aktifkan etalase online untuk pelanggan memesan langsung', 'storefront', 10),
  ('loyalty', 'Program Loyalti', 'Sistem poin dan reward pelanggan', 'storefront', 20),
  ('multi_outlet', 'Multi Outlet', 'Kelola lebih dari satu cabang', 'pos', 30),
  ('custom_domain', 'Custom Domain', 'Pakai domain sendiri (mis. tokoanda.com)', 'add_on', 40),
  ('theme_picker', 'Pilih Tema Storefront', 'Akses ke katalog tema desain', 'storefront', 50),
  ('priority_support', 'Priority Support', 'Respon dukungan dipercepat (≤ 2 jam jam kerja)', 'add_on', 60),
  ('advanced_reports', 'Laporan Lanjutan', 'Export Excel, dashboard analitik mendalam', 'pos', 70)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.themes (key, name, description, component_id, tier_hint, sort_order) VALUES
  ('classic', 'Classic', 'Layout default — bersih, fokus ke menu', 'classic', 'Semua paket', 10),
  ('minimal', 'Minimal Mono', 'Tipografi besar, satu kolom, monokrom', 'minimal', 'Pro & Pro Plus', 20),
  ('dark-luxe', 'Dark Luxe', 'Tema gelap mewah dengan aksen emas', 'dark-luxe', 'Pro & Pro Plus', 30),
  ('vibrant', 'Vibrant', 'Warna cerah penuh energi, cocok untuk kafe muda', 'vibrant', 'Pro Plus', 40)
ON CONFLICT (key) DO NOTHING;

-- Seed plans (basic free, pro, pro_plus). Skip jika sudah ada.
INSERT INTO public.plans (code, name, price_idr, duration_days, features, is_active, sort_order) VALUES
  ('basic', 'Basic', 0, 36500, '{}'::jsonb, true, 10),
  ('pro', 'Pro', 99000, 30, '{}'::jsonb, true, 20),
  ('pro_plus', 'Pro Plus', 199000, 30, '{}'::jsonb, true, 30)
ON CONFLICT (code) DO NOTHING;

-- Seed plan_features (idempotent)
DO $$
DECLARE
  v_basic uuid; v_pro uuid; v_plus uuid;
BEGIN
  SELECT id INTO v_basic FROM public.plans WHERE code = 'basic';
  SELECT id INTO v_pro FROM public.plans WHERE code = 'pro';
  SELECT id INTO v_plus FROM public.plans WHERE code = 'pro_plus';

  IF v_basic IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_key, requires_min_months) VALUES
      (v_basic, 'online_orders', 0)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_themes (plan_id, theme_key, requires_min_months) VALUES
      (v_basic, 'classic', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_pro IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_key, requires_min_months) VALUES
      (v_pro, 'online_orders', 0),
      (v_pro, 'loyalty', 0),
      (v_pro, 'multi_outlet', 0),
      (v_pro, 'theme_picker', 0),
      (v_pro, 'custom_domain', 12)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_themes (plan_id, theme_key, requires_min_months) VALUES
      (v_pro, 'classic', 0),
      (v_pro, 'minimal', 0),
      (v_pro, 'dark-luxe', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_plus IS NOT NULL THEN
    INSERT INTO public.plan_features (plan_id, feature_key, requires_min_months) VALUES
      (v_plus, 'online_orders', 0),
      (v_plus, 'loyalty', 0),
      (v_plus, 'multi_outlet', 0),
      (v_plus, 'theme_picker', 0),
      (v_plus, 'priority_support', 0),
      (v_plus, 'advanced_reports', 0),
      (v_plus, 'custom_domain', 6)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.plan_themes (plan_id, theme_key, requires_min_months) VALUES
      (v_plus, 'classic', 0),
      (v_plus, 'minimal', 0),
      (v_plus, 'dark-luxe', 0),
      (v_plus, 'vibrant', 0)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============= RPC: entitlements =============
CREATE OR REPLACE FUNCTION public.get_shop_entitlements(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop coffee_shops%ROWTYPE;
  v_plan_code text;
  v_effective_plan_id uuid;
  v_months_active numeric;
  v_features jsonb;
  v_themes jsonb;
BEGIN
  SELECT * INTO v_shop FROM coffee_shops WHERE id = _shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'shop_not_found');
  END IF;

  -- Resolve effective plan: kalau pro/pro_plus expired → fallback ke basic
  v_plan_code := v_shop.plan;
  IF v_shop.plan_expires_at IS NOT NULL AND v_shop.plan_expires_at < now() THEN
    v_plan_code := 'basic';
  END IF;
  IF v_plan_code IN ('free', 'basic') THEN
    v_plan_code := 'basic';
  END IF;

  SELECT id INTO v_effective_plan_id FROM plans WHERE code = v_plan_code;
  IF v_effective_plan_id IS NULL THEN
    SELECT id INTO v_effective_plan_id FROM plans WHERE code = 'basic';
  END IF;

  v_months_active := GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_shop.plan_started_at, v_shop.created_at))) / 2592000.0);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', f.key,
    'name', f.name,
    'description', f.description,
    'category', f.category,
    'requires_min_months', pf.requires_min_months,
    'limit_value', pf.limit_value,
    'allowed', v_months_active >= pf.requires_min_months,
    'reason', CASE WHEN v_months_active >= pf.requires_min_months THEN NULL
                   ELSE 'Tersedia setelah ' || pf.requires_min_months || ' bulan berlangganan' END
  ) ORDER BY f.sort_order), '[]'::jsonb)
  INTO v_features
  FROM plan_features pf
  JOIN features f ON f.key = pf.feature_key
  WHERE pf.plan_id = v_effective_plan_id AND f.is_active = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', t.key,
    'name', t.name,
    'description', t.description,
    'preview_image_url', t.preview_image_url,
    'component_id', t.component_id,
    'requires_min_months', pt.requires_min_months,
    'allowed', v_months_active >= pt.requires_min_months,
    'reason', CASE WHEN v_months_active >= pt.requires_min_months THEN NULL
                   ELSE 'Tersedia setelah ' || pt.requires_min_months || ' bulan berlangganan' END
  ) ORDER BY t.sort_order), '[]'::jsonb)
  INTO v_themes
  FROM plan_themes pt
  JOIN themes t ON t.key = pt.theme_key
  WHERE pt.plan_id = v_effective_plan_id AND t.is_active = true;

  RETURN jsonb_build_object(
    'plan_code', v_plan_code,
    'plan_expires_at', v_shop.plan_expires_at,
    'plan_started_at', v_shop.plan_started_at,
    'months_active', round(v_months_active, 2),
    'active_theme_key', v_shop.active_theme_key,
    'features', v_features,
    'themes', v_themes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shop_entitlements(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shop_entitlements(uuid) TO authenticated;

-- ============= RPC: set theme =============
CREATE OR REPLACE FUNCTION public.set_shop_theme(_shop_id uuid, _theme_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_ent jsonb;
  v_allowed boolean := false;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT owner_id INTO v_owner FROM coffee_shops WHERE id = _shop_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'shop_not_found'; END IF;
  IF v_owner <> v_caller AND NOT public.has_role(v_caller, 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_ent := public.get_shop_entitlements(_shop_id);

  SELECT bool_or((t->>'allowed')::boolean) INTO v_allowed
  FROM jsonb_array_elements(v_ent->'themes') t
  WHERE t->>'key' = _theme_key;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'theme_not_entitled';
  END IF;

  UPDATE coffee_shops SET active_theme_key = _theme_key, updated_at = now() WHERE id = _shop_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_shop_theme(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_shop_theme(uuid, text) TO authenticated;

-- ============= RPC: admin upserts =============
CREATE OR REPLACE FUNCTION public.admin_upsert_plan_feature(_plan_id uuid, _feature_key text, _requires_min_months int, _limit_value int, _meta jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  INSERT INTO plan_features (plan_id, feature_key, requires_min_months, limit_value, meta)
  VALUES (_plan_id, _feature_key, COALESCE(_requires_min_months, 0), _limit_value, COALESCE(_meta, '{}'::jsonb))
  ON CONFLICT (plan_id, feature_key) DO UPDATE
    SET requires_min_months = EXCLUDED.requires_min_months,
        limit_value = EXCLUDED.limit_value,
        meta = EXCLUDED.meta;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_remove_plan_feature(_plan_id uuid, _feature_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  DELETE FROM plan_features WHERE plan_id = _plan_id AND feature_key = _feature_key;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_plan_theme(_plan_id uuid, _theme_key text, _requires_min_months int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  INSERT INTO plan_themes (plan_id, theme_key, requires_min_months)
  VALUES (_plan_id, _theme_key, COALESCE(_requires_min_months, 0))
  ON CONFLICT (plan_id, theme_key) DO UPDATE
    SET requires_min_months = EXCLUDED.requires_min_months;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_remove_plan_theme(_plan_id uuid, _theme_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  DELETE FROM plan_themes WHERE plan_id = _plan_id AND theme_key = _theme_key;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_feature(_key text, _name text, _description text, _category text, _is_active boolean, _sort_order int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  INSERT INTO features (key, name, description, category, is_active, sort_order)
  VALUES (_key, _name, _description, COALESCE(_category, 'general'), COALESCE(_is_active, true), COALESCE(_sort_order, 0))
  ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_theme(_key text, _name text, _description text, _component_id text, _preview_image_url text, _tier_hint text, _is_active boolean, _sort_order int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  INSERT INTO themes (key, name, description, component_id, preview_image_url, tier_hint, is_active, sort_order)
  VALUES (_key, _name, _description, _component_id, _preview_image_url, _tier_hint, COALESCE(_is_active, true), COALESCE(_sort_order, 0))
  ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        component_id = EXCLUDED.component_id,
        preview_image_url = EXCLUDED.preview_image_url,
        tier_hint = EXCLUDED.tier_hint,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        updated_at = now();
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_upsert_plan_feature(uuid, text, int, int, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_plan_feature(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_plan_theme(uuid, text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_plan_theme(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_feature(text, text, text, text, boolean, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_theme(text, text, text, text, text, text, boolean, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_plan_feature(uuid, text, int, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_plan_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_plan_theme(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_plan_theme(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_feature(text, text, text, text, boolean, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_theme(text, text, text, text, text, text, boolean, int) TO authenticated;
