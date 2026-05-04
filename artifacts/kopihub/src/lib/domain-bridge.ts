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

export type VerifyResult = {
  verified: boolean;
  cnameOk: boolean;
  sslOk: boolean;
  sslError: string | null;
  txtValues: string[];
  cnameTarget: string;
};

const CNAME_TARGET = "tenants.kopihub.app";

export async function verifyCustomDomainBridge(): Promise<VerifyResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data: shop } = await supabase.from("coffee_shops").select("id, custom_domain, custom_domain_verify_token").eq("owner_id", user.id).maybeSingle();
  if (!shop?.custom_domain || !shop?.custom_domain_verify_token) throw new Error("no_domain");

  const domain = shop.custom_domain as string;
  const expectedToken = shop.custom_domain_verify_token as string;

  const base: VerifyResult = {
    verified: false,
    cnameOk: false,
    sslOk: false,
    sslError: null,
    txtValues: [],
    cnameTarget: CNAME_TARGET,
  };

  try {
    const [txtRes, cnameRes] = await Promise.all([
      fetch(`https://1.1.1.1/dns-query?name=_kopihub-verify.${domain}&type=TXT`, { headers: { Accept: "application/dns-json" } })
        .then((r) => r.json() as Promise<{ Answer?: Array<{ data: string }> }>)
        .catch(() => ({ Answer: [] as Array<{ data: string }> })),
      fetch(`https://1.1.1.1/dns-query?name=${domain}&type=CNAME`, { headers: { Accept: "application/dns-json" } })
        .then((r) => r.json() as Promise<{ Answer?: Array<{ data: string }> }>)
        .catch(() => ({ Answer: [] as Array<{ data: string }> })),
    ]);

    const txtValues = (txtRes.Answer ?? []).map((a) => a.data.replace(/"/g, ""));
    base.txtValues = txtValues;

    const txtFound = txtValues.some((v) => v === expectedToken);
    const cnameOk = (cnameRes.Answer ?? []).some((a) => a.data.replace(/\.$/, "") === CNAME_TARGET);
    base.cnameOk = cnameOk;

    if (txtFound) {
      await supabase.from("coffee_shops").update({ custom_domain_verified_at: new Date().toISOString() }).eq("id", shop.id);
      base.verified = true;
    }

    return base;
  } catch {
    return base;
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
