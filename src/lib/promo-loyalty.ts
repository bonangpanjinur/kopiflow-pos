import { supabase } from "@/integrations/supabase/client";

export type PromoValidation = {
  promo_id: string | null;
  code: string;
  discount: number;
  error: string | null;
};

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

export async function getUserPoints(shopId: string, userId: string): Promise<number> {
  const { data } = await supabase
    .from("loyalty_points")
    .select("balance")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.balance ?? 0;
}

export function calcPointsEarned(subtotal: number, settings: LoyaltySettings | null): number {
  if (!settings || settings.rupiah_per_point <= 0) return 0;
  return Math.floor(subtotal / settings.rupiah_per_point);
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
    await supabase.from("promo_redemptions").insert({
      promo_id: promoId,
      order_id: orderId,
      shop_id: shopId,
      user_id: userId,
      amount: promoDiscount,
    });
    // increment usage_count (RLS: owner only — best effort, may fail silently)
    await supabase.rpc("increment_promo_usage" as never, { _promo_id: promoId } as never).catch(
      () => {},
    );
  }

  if (!userId) return;

  if (pointsEarned > 0 || pointsRedeemed > 0) {
    const delta = pointsEarned - pointsRedeemed;
    const { data: existing } = await supabase
      .from("loyalty_points")
      .select("balance,total_earned,total_redeemed")
      .eq("shop_id", shopId)
      .eq("user_id", userId)
      .maybeSingle();

    const next = {
      shop_id: shopId,
      user_id: userId,
      balance: (existing?.balance ?? 0) + delta,
      total_earned: (existing?.total_earned ?? 0) + pointsEarned,
      total_redeemed: (existing?.total_redeemed ?? 0) + pointsRedeemed,
    };
    await supabase.from("loyalty_points").upsert(next, { onConflict: "shop_id,user_id" });

    if (pointsEarned > 0) {
      await supabase.from("loyalty_ledger").insert({
        shop_id: shopId,
        user_id: userId,
        order_id: orderId,
        delta: pointsEarned,
        reason: "earn",
      });
    }
    if (pointsRedeemed > 0) {
      await supabase.from("loyalty_ledger").insert({
        shop_id: shopId,
        user_id: userId,
        order_id: orderId,
        delta: -pointsRedeemed,
        reason: "redeem",
      });
    }
  }
}
