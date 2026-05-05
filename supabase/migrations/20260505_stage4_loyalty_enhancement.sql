-- Stage 4: Loyalty Program Enhancement

-- 1. Create loyalty_tiers table (if not exists)
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  description TEXT,
  benefits TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, name)
);

CREATE INDEX idx_loyalty_tiers_shop_id ON public.loyalty_tiers(shop_id);

-- 2. Create loyalty_rewards table
CREATE TABLE public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  reward_type VARCHAR(50) NOT NULL DEFAULT 'discount', -- discount, product, voucher, free_item
  reward_value NUMERIC(10,2),
  reward_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  max_redemptions_per_customer INTEGER,
  total_redemptions_limit INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_rewards_shop_id ON public.loyalty_rewards(shop_id);
CREATE INDEX idx_loyalty_rewards_is_active ON public.loyalty_rewards(shop_id, is_active);

-- 3. Create loyalty_redemptions table
CREATE TABLE public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  user_id UUID NOT REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points_redeemed INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_redemptions_shop_id ON public.loyalty_redemptions(shop_id);
CREATE INDEX idx_loyalty_redemptions_user_id ON public.loyalty_redemptions(user_id);
CREATE INDEX idx_loyalty_redemptions_reward_id ON public.loyalty_redemptions(reward_id);

-- 4. Create referral_program table
CREATE TABLE public.referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  referrer_bonus_points INTEGER NOT NULL DEFAULT 0,
  referrer_bonus_rupiah NUMERIC(10,2) DEFAULT 0,
  referee_bonus_points INTEGER NOT NULL DEFAULT 0,
  referee_bonus_rupiah NUMERIC(10,2) DEFAULT 0,
  min_order_value_for_bonus NUMERIC(10,2),
  max_referrals_per_user INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_programs_shop_id ON public.referral_programs(shop_id);

-- 5. Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.referral_programs(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, converted, expired
  converted_at TIMESTAMPTZ,
  bonus_awarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_shop_id ON public.referrals(shop_id);
CREATE INDEX idx_referrals_referrer_user_id ON public.referrals(referrer_user_id);
CREATE INDEX idx_referrals_referee_user_id ON public.referrals(referee_user_id);
CREATE INDEX idx_referrals_referral_code ON public.referrals(referral_code);

-- 6. Create loyalty_analytics table
CREATE TABLE public.loyalty_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_points_earned BIGINT NOT NULL DEFAULT 0,
  total_points_redeemed BIGINT NOT NULL DEFAULT 0,
  total_members INTEGER NOT NULL DEFAULT 0,
  active_members INTEGER NOT NULL DEFAULT 0,
  new_members INTEGER NOT NULL DEFAULT 0,
  total_rewards_redeemed INTEGER NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, date)
);

CREATE INDEX idx_loyalty_analytics_shop_id ON public.loyalty_analytics(shop_id, date);

-- 7. Enable RLS for loyalty tables
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_analytics ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for loyalty_tiers
CREATE POLICY "users can view loyalty_tiers of their shops"
  ON public.loyalty_tiers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = loyalty_tiers.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage loyalty_tiers of their shops"
  ON public.loyalty_tiers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = loyalty_tiers.shop_id
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

-- 9. RLS Policies for loyalty_rewards
CREATE POLICY "users can view loyalty_rewards of their shops"
  ON public.loyalty_rewards FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = loyalty_rewards.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage loyalty_rewards of their shops"
  ON public.loyalty_rewards FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = loyalty_rewards.shop_id
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

-- 10. RLS Policies for loyalty_redemptions
CREATE POLICY "users can view loyalty_redemptions of their shops"
  ON public.loyalty_redemptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = loyalty_redemptions.shop_id
      AND owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "users can insert loyalty_redemptions"
  ON public.loyalty_redemptions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
  );

-- 11. RLS Policies for referral_programs
CREATE POLICY "users can view referral_programs of their shops"
  ON public.referral_programs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = referral_programs.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can manage referral_programs of their shops"
  ON public.referral_programs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = referral_programs.shop_id
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

-- 12. RLS Policies for referrals
CREATE POLICY "users can view referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (
    referrer_user_id = auth.uid()
    OR referee_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = referrals.shop_id
      AND owner_id = auth.uid()
    )
  );

CREATE POLICY "users can insert referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (
    referrer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = shop_id
      AND owner_id = auth.uid()
    )
  );

-- 13. RLS Policies for loyalty_analytics
CREATE POLICY "users can view loyalty_analytics of their shops"
  ON public.loyalty_analytics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_shops
      WHERE id = loyalty_analytics.shop_id
      AND owner_id = auth.uid()
    )
  );

-- 14. Triggers for updated_at
CREATE TRIGGER loyalty_tiers_touch
  BEFORE UPDATE ON public.loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER loyalty_rewards_touch
  BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER referral_programs_touch
  BEFORE UPDATE ON public.referral_programs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER referrals_touch
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER loyalty_analytics_touch
  BEFORE UPDATE ON public.loyalty_analytics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 15. Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS VARCHAR AS $$
DECLARE
  _code VARCHAR;
  _exists BOOLEAN;
BEGIN
  LOOP
    _code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.referrals WHERE referral_code = _code) INTO _exists;
    EXIT WHEN NOT _exists;
  END LOOP;
  RETURN _code;
END;
$$ LANGUAGE plpgsql;

-- 16. Function to award referral bonus
CREATE OR REPLACE FUNCTION public.award_referral_bonus(
  _referral_id UUID
)
RETURNS void AS $$
DECLARE
  _referral RECORD;
  _program RECORD;
  _referee_customer RECORD;
BEGIN
  SELECT * INTO _referral FROM public.referrals WHERE id = _referral_id;
  SELECT * INTO _program FROM public.referral_programs WHERE id = _referral.program_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referral or program not found';
  END IF;

  -- Award referrer bonus
  IF _program.referrer_bonus_points > 0 THEN
    UPDATE public.loyalty_points
    SET balance = balance + _program.referrer_bonus_points
    WHERE shop_id = _referral.shop_id AND user_id = _referral.referrer_user_id;
  END IF;

  -- Award referee bonus
  IF _program.referee_bonus_points > 0 AND _referral.referee_user_id IS NOT NULL THEN
    UPDATE public.loyalty_points
    SET balance = balance + _program.referee_bonus_points
    WHERE shop_id = _referral.shop_id AND user_id = _referral.referee_user_id;
  END IF;

  -- Update referral status
  UPDATE public.referrals
  SET status = 'converted', converted_at = now(), bonus_awarded_at = now()
  WHERE id = _referral_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
