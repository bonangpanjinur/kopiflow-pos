import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import dns from "node:dns/promises";

const DOMAIN_RE = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

function makeToken() {
  return "kh_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function getOwnedShop(supabase: any, userId: string) {
  const { data: shop } = await supabase
    .from("coffee_shops")
    .select("id, plan, plan_expires_at, custom_domain, custom_domain_verify_token, custom_domain_verified_at")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const exp = shop.plan_expires_at ? new Date(shop.plan_expires_at).getTime() : 0;
  const isPro = shop.plan === "pro" && (!exp || exp > Date.now());
  if (!isPro) throw new Error("pro_plan_required");
  return shop;
}

export const requestCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ domain: z.string().min(3).max(253).regex(DOMAIN_RE) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const shop = await getOwnedShop(supabase, userId);
    const domain = data.domain.toLowerCase();
    const token = makeToken();

    const { error } = await supabase
      .from("coffee_shops")
      .update({
        custom_domain: domain,
        custom_domain_verify_token: token,
        custom_domain_verified_at: null,
      })
      .eq("id", shop.id);
    if (error) throw new Error(error.message);

    await supabase.from("domain_audit").insert({
      shop_id: shop.id,
      old_domain: shop.custom_domain,
      new_domain: domain,
      action: "request",
      actor_id: userId,
    });

    return { domain, token };
  });

export const verifyCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const shop = await getOwnedShop(supabase, userId);
    if (!shop.custom_domain || !shop.custom_domain_verify_token) {
      throw new Error("no_domain_pending");
    }
    const recordName = `_kopihub-verify.${shop.custom_domain}`;
    let found = false;
    try {
      const records = await dns.resolveTxt(recordName);
      const flat = records.map((r) => r.join("")).map((s) => s.trim());
      found = flat.some((v) => v === shop.custom_domain_verify_token);
    } catch {
      found = false;
    }

    if (found) {
      const { error } = await supabase
        .from("coffee_shops")
        .update({ custom_domain_verified_at: new Date().toISOString() })
        .eq("id", shop.id);
      if (error) throw new Error(error.message);
      await supabase.from("domain_audit").insert({
        shop_id: shop.id,
        new_domain: shop.custom_domain,
        action: "verify",
        actor_id: userId,
      });
    }
    return { verified: found, expectedRecord: recordName, expectedValue: shop.custom_domain_verify_token };
  });

export const removeCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: shop } = await supabase
      .from("coffee_shops")
      .select("id, custom_domain")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!shop) throw new Error("shop_not_found");
    const { error } = await supabase
      .from("coffee_shops")
      .update({ custom_domain: null, custom_domain_verified_at: null, custom_domain_verify_token: null })
      .eq("id", shop.id);
    if (error) throw new Error(error.message);
    await supabase.from("domain_audit").insert({
      shop_id: shop.id,
      old_domain: shop.custom_domain,
      action: "remove",
      actor_id: userId,
    });
    return { ok: true };
  });
