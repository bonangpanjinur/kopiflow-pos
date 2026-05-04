import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const DOMAIN_RE = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

export async function requestCustomDomainBridge({ data }: { data: { domain: string } }) {
  const { domain } = z.object({ domain: z.string().min(3).max(253).regex(DOMAIN_RE) }).parse(data);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data: shop } = await supabase.from("coffee_shops").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const token = `kopihub-verify=${Math.random().toString(36).slice(2)}`;
  const { error } = await supabase.from("coffee_shops").update({ custom_domain: domain, custom_domain_verify_token: token, custom_domain_verified_at: null }).eq("id", shop.id);
  if (error) throw error;
  return { token, instructions: `Add TXT record _kopihub-verify.${domain} = ${token}` };
}

export async function verifyCustomDomainBridge() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data: shop } = await supabase.from("coffee_shops").select("id, custom_domain, custom_domain_verify_token").eq("owner_id", user.id).maybeSingle();
  if (!shop?.custom_domain || !shop?.custom_domain_verify_token) throw new Error("no_domain");
  // DNS check via DoH
  try {
    const res = await fetch(`https://1.1.1.1/dns-query?name=_kopihub-verify.${shop.custom_domain}&type=TXT`, { headers: { Accept: "application/dns-json" } });
    const json = await res.json() as { Answer?: Array<{ data: string }> };
    const found = (json.Answer ?? []).some(a => a.data.replace(/"/g, "") === shop.custom_domain_verify_token);
    if (found) {
      await supabase.from("coffee_shops").update({ custom_domain_verified_at: new Date().toISOString() }).eq("id", shop.id);
      return { verified: true };
    }
    return { verified: false };
  } catch {
    return { verified: false };
  }
}

export async function removeCustomDomainBridge() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data: shop } = await supabase.from("coffee_shops").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  await supabase.from("coffee_shops").update({ custom_domain: null, custom_domain_verify_token: null, custom_domain_verified_at: null }).eq("id", shop.id);
  return { removed: true };
}
