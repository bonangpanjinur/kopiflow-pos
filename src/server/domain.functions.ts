import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import dns from "node:dns/promises";

const DOMAIN_RE = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

function makeToken() {
  return "kh_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Conflict check: domain must be unique across shops
    const { data: existing } = await supabaseAdmin
      .from("coffee_shops")
      .select("id")
      .eq("custom_domain", domain)
      .neq("id", shop.id)
      .maybeSingle();
    if (existing) throw new Error("domain_already_taken");

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
    const expectedValue = shop.custom_domain_verify_token;

    let txtFound = false;
    let txtValues: string[] = [];
    try {
      const records = await dns.resolveTxt(recordName);
      txtValues = records.map((r) => r.join("")).map((s) => s.trim());
      txtFound = txtValues.some((v) => v === expectedValue);
    } catch {
      txtFound = false;
    }

    // Also check CNAME points to our proxy target (advisory; not blocker for verification)
    let cnameOk = false;
    let cnameTarget = "";
    try {
      const { data: settings } = await supabaseAdmin
        .from("billing_settings")
        .select("instructions")
        .eq("id", 1)
        .maybeSingle();
      // Read configured target from billing_settings.instructions metadata isn't ideal;
      // we use a fixed env-overridable default below.
      cnameTarget = process.env.TENANT_PROXY_TARGET ?? "tenants.kopihub.app";
      const cnames = await dns.resolveCname(shop.custom_domain).catch(() => [] as string[]);
      cnameOk = cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === cnameTarget.toLowerCase());
      void settings;
    } catch {
      cnameOk = false;
    }

    if (txtFound) {
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
        notes: cnameOk ? "txt+cname ok" : "txt ok, cname not detected",
      });
    }
    return {
      verified: txtFound,
      cnameOk,
      expectedRecord: recordName,
      expectedValue,
      cnameTarget,
      txtValues,
    };
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

/**
 * Resolve current request Host header to a tenant shop slug.
 * Returns { tenantSlug } when the host is a verified custom domain,
 * or { tenantSlug: null } for the platform host.
 *
 * Used by the root route loader to drive multi-tenant routing.
 */
export const resolveHost = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const rawHost = (getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "").toLowerCase();
  if (!rawHost) return { tenantSlug: null as string | null, host: "" };
  const host = rawHost.split(":")[0];

  // Skip platform hosts: lovable.app, localhost, *.lovable.app
  if (
    host === "localhost" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host === "127.0.0.1"
  ) {
    return { tenantSlug: null, host };
  }

  const { data, error } = await supabaseAdmin
    .from("coffee_shops")
    .select("slug, custom_domain_verified_at")
    .eq("custom_domain", host)
    .maybeSingle();
  if (error || !data) return { tenantSlug: null, host };
  if (!data.custom_domain_verified_at) return { tenantSlug: null, host };
  return { tenantSlug: data.slug as string, host };
});
