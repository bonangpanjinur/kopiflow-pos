import { supabase } from "@/integrations/supabase/client";

export type PromoValidation = {
  promo_id: string | null;
  code: string;
  discount: number;
  error: string | null;
};

export async function getAutoPromos(
  shopId: string,
  subtotal: number,
  channel: "pos" | "online" | "all",
): Promise<PromoValidation[]> {
  const { data, error } = await supabase
    .from("promos")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .eq("code", "") // Auto-promo typically has no code or a specific flag
    .lte("min_order", subtotal)
    .or(`channel.eq.${channel},channel.eq.all`);

  if (error || !data) return [];

  return data.map((p) => ({
    promo_id: p.id,
    code: p.code,
    discount: p.type === "percent" 
      ? Math.min((subtotal * p.value) / 100, p.max_discount || Infinity)
      : p.value,
    error: null,
  }));
}

export async function validatePromo(
  shopId: string,
  code: string,
  subtotal: number,
  channel: "pos" | "online",
): Promise<PromoValidation> {
  const { data, error } = await supabase.rpc("validate_promo", {
    _shop_id: shopId,
    _code: code,
    _subtotal: subtotal,
    _channel: channel,
  });
  if (error) {
    return { promo_id: null, code, discount: 0, error: error.message };
  }
  const row = (data ?? [])[0] as PromoValidation | undefined;
  if (!row) return { promo_id: null, code, discount: 0, error: "Tidak ditemukan" };
  return {
    promo_id: row.promo_id,
    code: row.code,
    discount: Number(row.discount) || 0,
    error: row.error,
  };
}

export type LoyaltySettings = {
  shop_id: string;
  is_active: boolean;
  rupiah_per_point: number;
  point_value: number;
  min_redeem_points: number;
  max_redeem_percent: number;
};

export async function getLoyaltySettings(shopId: string): Promise<LoyaltySettings | null> {
  const { data } = await supabase
    .from("loyalty_settings")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return data as LoyaltySettings;
}

export type LoyaltyTier = {
  id: string;
  name: string;
  min_points: number;
  multiplier: number;
};

export async function getUserLoyalty(shopId: string, userId: string): Promise<{ balance: number; tier: LoyaltyTier | null }> {
  const { data: points } = await supabase
    .from("loyalty_points")
    .select("balance")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();
  
  const balance = points?.balance ?? 0;

  const { data: tiers } = await supabase
    .from("loyalty_tiers" as any)
    .select("*")
    .eq("shop_id", shopId)
    .lte("min_points", balance)
    .order("min_points", { ascending: false })
    .limit(1);

  return {
    balance,
    tier: (tiers?.[0] as unknown as LoyaltyTier) ?? null,
  };
}

export async function getUserPoints(shopId: string, userId: string): Promise<number> {
  const { balance } = await getUserLoyalty(shopId, userId);
  return balance;
}

export function calcPointsEarned(subtotal: number, settings: LoyaltySettings | null, tier?: LoyaltyTier | null): number {
  if (!settings || settings.rupiah_per_point <= 0) return 0;
  const basePoints = Math.floor(subtotal / settings.rupiah_per_point);
  const multiplier = tier?.multiplier ?? 1;
  return Math.floor(basePoints * multiplier);
}

export function maxRedeemDiscount(
  subtotal: number,
  balance: number,
  settings: LoyaltySettings | null,
): { maxPoints: number; maxRupiah: number } {
  if (!settings || settings.point_value <= 0) return { maxPoints: 0, maxRupiah: 0 };
  const capRupiah = Math.floor((subtotal * settings.max_redeem_percent) / 100);
  const capByPoints = balance * settings.point_value;
  const maxRupiah = Math.min(capRupiah, capByPoints);
  const maxPoints = Math.floor(maxRupiah / settings.point_value);
  return { maxPoints, maxRupiah: maxPoints * settings.point_value };
}

/**
 * After an order is created, record promo redemption + loyalty earn/redeem.
 * Loyalty path uses a SECURITY DEFINER RPC to bypass RLS safely.
 * Best-effort; failures are logged but don't roll back the order.
 */
export async function applyPostOrder(args: {
  shopId: string;
  orderId: string;
  userId: string | null;
  promoId: string | null;
  promoDiscount: number;
  pointsEarned: number;
  pointsRedeemed: number;
}) {
  const { shopId, orderId, userId, promoId, promoDiscount, pointsEarned, pointsRedeemed } = args;

  if (promoId) {
    const { error } = await supabase.from("promo_redemptions").insert({
      promo_id: promoId,
      order_id: orderId,
      shop_id: shopId,
      user_id: userId,
      amount: promoDiscount,
    });
    if (error) console.warn("[promo_redemption] insert failed:", error.message);
    const { error: incErr } = await supabase.rpc("increment_promo_usage", { _promo_id: promoId });
    if (incErr) console.warn("[promo_usage] increment failed:", incErr.message);
  }

  if (!userId) return;
  if (pointsEarned <= 0 && pointsRedeemed <= 0) return;

  const { error } = await supabase.rpc("apply_loyalty_post_order", {
    _shop_id: shopId,
    _user_id: userId,
    _order_id: orderId,
    _earned: pointsEarned,
    _redeemed: pointsRedeemed,
  });
  if (error) console.warn("[loyalty] apply failed:", error.message);
}
