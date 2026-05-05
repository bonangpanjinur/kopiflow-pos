import { supabase } from "@/integrations/supabase/client";

export async function getEntitlements() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("get_my_entitlements" as any);
  return data;
}

export async function setShopTheme({ data }: { data: { themeKey: string } }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data: shop } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const { error } = await supabase.from("businesses").update({ theme_key: data.themeKey } as any).eq("id", shop.id);
  if (error) throw error;
  return { ok: true };
}

export async function getPublicShopTheme({ data }: { data: { slug: string } }) {
  const { data: shop } = await supabase.from("businesses").select("theme_key").eq("slug", data.slug).maybeSingle();
  return { themeKey: (shop as any)?.theme_key ?? "classic" };
}
