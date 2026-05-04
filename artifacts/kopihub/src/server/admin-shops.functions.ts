import { supabase } from "@/integrations/supabase/client";

export async function getShopDetail({ data }: { data: { shopId: string } }) {
  const { data: shop, error } = await supabase.from("coffee_shops").select("*").eq("id", data.shopId).maybeSingle();
  if (error) throw error;
  return shop as unknown as {
    shop: typeof shop;
    owner: { id: string; email: string; last_sign_in_at: string | null } | null;
    ownerEmail: string | null;
    ownerLastSignIn: string | null;
  };
}

export async function setShopPlanManual({ data }: { data: { shopId: string; plan: string; expiresAt: string | null } }) {
  const { error } = await supabase.rpc("admin_set_shop_plan" as any, { _shop_id: data.shopId, _plan: data.plan, _expires_at: data.expiresAt });
  if (error) throw error;
  return { ok: true };
}

export async function suspendShop({ data }: { data: { shopId: string; reason: string } }) {
  const { error } = await supabase.rpc("admin_suspend_shop" as any, { _shop_id: data.shopId, _reason: data.reason });
  if (error) throw error;
  return { ok: true };
}

export async function unsuspendShop({ data }: { data: { shopId: string } }) {
  const { error } = await supabase.rpc("admin_unsuspend_shop" as any, { _shop_id: data.shopId });
  if (error) throw error;
  return { ok: true };
}

export async function sendOwnerPasswordReset({ data }: { data: { shopId: string } }): Promise<{ email: string }> {
  const { data: shop } = await supabase.from("coffee_shops").select("owner_id").eq("id", data.shopId).maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const { data: profile } = await supabase.from("profiles" as any).select("email").eq("id", (shop as any).owner_id).maybeSingle();
  if (!profile) throw new Error("user_not_found");
  const email = (profile as any).email as string;
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return { email };
}
