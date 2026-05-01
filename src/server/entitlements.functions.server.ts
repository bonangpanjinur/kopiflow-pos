import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EntitlementFeature = {
  key: string;
  name: string;
  description: string | null;
  category: string;
  requires_min_months: number;
  limit_value: number | null;
  allowed: boolean;
  reason: string | null;
};

export type EntitlementTheme = {
  key: string;
  name: string;
  description: string | null;
  preview_image_url: string | null;
  component_id: string;
  requires_min_months: number;
  allowed: boolean;
  reason: string | null;
};

export type Entitlements = {
  plan_code: string;
  plan_expires_at: string | null;
  plan_started_at: string | null;
  months_active: number;
  active_theme_key: string;
  features: EntitlementFeature[];
  themes: EntitlementTheme[];
};

export const getEntitlements = async ({ context }: { context: any }): Promise<Entitlements> => {
  const { supabase, userId } = context;
  const { data: shop } = await supabase
    .from("coffee_shops")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const { data, error } = await supabase.rpc("get_shop_entitlements", { _shop_id: shop.id });
  if (error) throw new Error(error.message);
  return data as unknown as Entitlements;
};

export const setShopTheme = async ({ data, context }: { data: any, context: any }) => {
  const { supabase, userId } = context;
  const { data: shop } = await supabase
    .from("coffee_shops")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const { error } = await supabase.rpc("set_shop_theme", { _shop_id: shop.id, _theme_key: data.themeKey });
  if (error) throw new Error(error.message);
  return { ok: true };
};

export const getPublicShopTheme = async ({ data }: { data: any }) => {
  const { data: shop } = await supabaseAdmin
    .from("coffee_shops")
    .select("active_theme_key, plan")
    .eq("slug", data.slug)
    .eq("is_active", true)
    .is("suspended_at", null)
    .maybeSingle();
  return { themeKey: shop?.active_theme_key ?? "classic", plan: shop?.plan ?? "basic" };
};
