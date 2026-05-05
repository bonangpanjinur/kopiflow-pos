import { supabase } from "@/integrations/supabase/client";
import type {
  LoyaltyTier,
  LoyaltyReward,
  LoyaltyRedemption,
  ReferralProgram,
  Referral,
  LoyaltyAnalytics,
  CreateLoyaltyRewardRequest,
  CreateReferralProgramRequest,
} from "@/types/stage4";

/**
 * Get loyalty tiers for a shop
 */
export async function getLoyaltyTiers(shopId: string): Promise<LoyaltyTier[]> {
  const { data, error } = await supabase
    .from("loyalty_tiers")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("min_points");

  if (error) {
    console.error("Error fetching loyalty tiers:", error);
    return [];
  }

  return (data || []) as LoyaltyTier[];
}

/**
 * Get user's loyalty tier based on points
 */
export async function getUserLoyaltyTier(
  shopId: string,
  userId: string
): Promise<LoyaltyTier | null> {
  const { data: pointsData } = await supabase
    .from("loyalty_points")
    .select("balance")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!pointsData) return null;

  const { data: tierData } = await supabase
    .from("loyalty_tiers")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .lte("min_points", pointsData.balance)
    .order("min_points", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (tierData as LoyaltyTier) || null;
}

/**
 * Get available loyalty rewards
 */
export async function getAvailableRewards(
  shopId: string
): Promise<LoyaltyReward[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("loyalty_rewards")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .or(
      `valid_from.is.null,valid_from.lte.${now}`,
      { foreignTable: "loyalty_rewards" }
    )
    .or(
      `valid_until.is.null,valid_until.gte.${now}`,
      { foreignTable: "loyalty_rewards" }
    )
    .order("points_required");

  if (error) {
    console.error("Error fetching loyalty rewards:", error);
    return [];
  }

  return (data || []) as LoyaltyReward[];
}

/**
 * Get rewards a user can redeem
 */
export async function getRedeemableRewards(
  shopId: string,
  userId: string
): Promise<LoyaltyReward[]> {
  const { data: pointsData } = await supabase
    .from("loyalty_points")
    .select("balance")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!pointsData) return [];

  const allRewards = await getAvailableRewards(shopId);

  // Filter rewards user can afford
  const affordableRewards = allRewards.filter(
    (r) => r.points_required <= pointsData.balance
  );

  // Filter rewards that haven't exceeded redemption limits
  const validRewards = affordableRewards.filter((r) => {
    if (r.total_redemptions_limit) {
      return r.current_redemptions < r.total_redemptions_limit;
    }
    return true;
  });

  return validRewards;
}

/**
 * Redeem a loyalty reward
 */
export async function redeemReward(
  shopId: string,
  userId: string,
  rewardId: string,
  orderId?: string
): Promise<LoyaltyRedemption | null> {
  const { data, error } = await supabase
    .from("loyalty_redemptions")
    .insert({
      shop_id: shopId,
      user_id: userId,
      reward_id: rewardId,
      order_id: orderId || null,
      points_redeemed: 0, // Will be calculated by trigger
    })
    .select()
    .single();

  if (error) {
    console.error("Error redeeming reward:", error);
    return null;
  }

  return data as LoyaltyRedemption;
}

/**
 * Create a loyalty reward
 */
export async function createLoyaltyReward(
  shopId: string,
  request: CreateLoyaltyRewardRequest
): Promise<LoyaltyReward | null> {
  const { data, error } = await supabase
    .from("loyalty_rewards")
    .insert({
      shop_id: shopId,
      name: request.name,
      description: request.description || null,
      points_required: request.points_required,
      reward_type: request.reward_type,
      reward_value: request.reward_value || null,
      reward_item_id: request.reward_item_id || null,
      max_redemptions_per_customer: request.max_redemptions_per_customer || null,
      total_redemptions_limit: request.total_redemptions_limit || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating loyalty reward:", error);
    return null;
  }

  return data as LoyaltyReward;
}

/**
 * Get referral programs for a shop
 */
export async function getReferralPrograms(
  shopId: string
): Promise<ReferralProgram[]> {
  const { data, error } = await supabase
    .from("referral_programs")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching referral programs:", error);
    return [];
  }

  return (data || []) as ReferralProgram[];
}

/**
 * Create a referral program
 */
export async function createReferralProgram(
  shopId: string,
  request: CreateReferralProgramRequest
): Promise<ReferralProgram | null> {
  const { data, error } = await supabase
    .from("referral_programs")
    .insert({
      shop_id: shopId,
      name: request.name,
      description: request.description || null,
      referrer_bonus_points: request.referrer_bonus_points,
      referrer_bonus_rupiah: request.referrer_bonus_rupiah || 0,
      referee_bonus_points: request.referee_bonus_points,
      referee_bonus_rupiah: request.referee_bonus_rupiah || 0,
      min_order_value_for_bonus: request.min_order_value_for_bonus || null,
      max_referrals_per_user: request.max_referrals_per_user || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating referral program:", error);
    return null;
  }

  return data as ReferralProgram;
}

/**
 * Generate referral code for a user
 */
export async function generateReferralCode(
  shopId: string,
  programId: string,
  referrerUserId: string
): Promise<Referral | null> {
  const { data, error } = await supabase
    .from("referrals")
    .insert({
      shop_id: shopId,
      program_id: programId,
      referrer_user_id: referrerUserId,
      referral_code: "", // Will be generated by function
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error generating referral code:", error);
    return null;
  }

  return data as Referral;
}

/**
 * Get user's referral code
 */
export async function getUserReferralCode(
  shopId: string,
  programId: string,
  userId: string
): Promise<Referral | null> {
  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("shop_id", shopId)
    .eq("program_id", programId)
    .eq("referrer_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    console.error("Error fetching referral code:", error);
    return null;
  }

  return data as Referral | null;
}

/**
 * Redeem referral code
 */
export async function redeemReferralCode(
  shopId: string,
  referralCode: string,
  refereeUserId: string
): Promise<Referral | null> {
  const { data, error } = await supabase
    .from("referrals")
    .update({
      referee_user_id: refereeUserId,
      status: "converted",
      converted_at: new Date().toISOString(),
    })
    .eq("shop_id", shopId)
    .eq("referral_code", referralCode)
    .select()
    .single();

  if (error) {
    console.error("Error redeeming referral code:", error);
    return null;
  }

  return data as Referral;
}

/**
 * Award referral bonus
 */
export async function awardReferralBonus(referralId: string): Promise<boolean> {
  const { error } = await supabase.rpc("award_referral_bonus", {
    _referral_id: referralId,
  });

  if (error) {
    console.error("Error awarding referral bonus:", error);
    return false;
  }

  return true;
}

/**
 * Get loyalty analytics for a shop
 */
export async function getLoyaltyAnalytics(
  shopId: string,
  startDate: string,
  endDate: string
): Promise<LoyaltyAnalytics[]> {
  const { data, error } = await supabase
    .from("loyalty_analytics")
    .select("*")
    .eq("shop_id", shopId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    console.error("Error fetching loyalty analytics:", error);
    return [];
  }

  return (data || []) as LoyaltyAnalytics[];
}

/**
 * Get user's referral statistics
 */
export async function getUserReferralStats(
  shopId: string,
  userId: string
): Promise<{
  totalReferrals: number;
  convertedReferrals: number;
  pendingReferrals: number;
}> {
  const { data, error } = await supabase
    .from("referrals")
    .select("status")
    .eq("shop_id", shopId)
    .eq("referrer_user_id", userId);

  if (error) {
    console.error("Error fetching referral stats:", error);
    return {
      totalReferrals: 0,
      convertedReferrals: 0,
      pendingReferrals: 0,
    };
  }

  const referrals = (data || []) as Array<{ status: string }>;
  return {
    totalReferrals: referrals.length,
    convertedReferrals: referrals.filter((r) => r.status === "converted").length,
    pendingReferrals: referrals.filter((r) => r.status === "pending").length,
  };
}
