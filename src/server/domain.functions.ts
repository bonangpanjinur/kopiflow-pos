import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// DNS-over-HTTPS via Cloudflare 1.1.1.1 — works in serverless/edge runtimes
// where node:dns is unavailable.
async function dohResolve(name: string, type: "TXT" | "CNAME"): Promise<string[]> {
  try {
    const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    if (!json.Answer) return [];
    return json.Answer.map((a) => {
      const raw = a.data.trim();
      if (raw.startsWith('"') && raw.endsWith('"')) {
        return raw.slice(1, -1).replace(/"\s+"/g, "");
      }
      return raw.replace(/\.$/, "");
    });
  } catch {
    return [];
  }
}

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

async function isBlacklisted(domain: string): Promise<boolean> {
  // Match either the full host or any label segment
  const labels = domain.split(".");
  const candidates = new Set<string>([domain, ...labels]);
  // Also check parent suffix (e.g. `lovable.app` blocks `foo.lovable.app`)
  for (let i = 1; i < labels.length - 1; i++) {
    candidates.add(labels.slice(i).join("."));
  }
  const { data } = await supabaseAdmin
    .from("domain_blacklist")
    .select("domain")
    .in("domain", Array.from(candidates));
  return (data?.length ?? 0) > 0;
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

    if (await isBlacklisted(domain)) {
      throw new Error("domain_reserved");
    }

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
        last_dns_check_at: null,
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

    // Rate-limit: max 5 attempts per hour per shop
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("domain_verify_attempts")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= 5) {
      throw new Error("rate_limited_try_later");
    }

    const recordName = `_kopihub-verify.${shop.custom_domain}`;
    const expectedValue = shop.custom_domain_verify_token;

    const txtValues = await dohResolve(recordName, "TXT");
    const txtFound = txtValues.some((v) => v === expectedValue);

    const cnameTarget = process.env.TENANT_PROXY_TARGET ?? "tenants.kopihub.app";
    const cnames = await dohResolve(shop.custom_domain, "CNAME");
    const cnameOk = cnames.some((c) => c.toLowerCase() === cnameTarget.toLowerCase());

    // Log attempt (best effort, ignore errors)
    await supabase.from("domain_verify_attempts").insert({
      shop_id: shop.id,
      actor_id: userId,
      domain: shop.custom_domain,
      result: txtFound ? "verified" : "txt_missing",
    });

    if (txtFound) {
      const { error } = await supabase
        .from("coffee_shops")
        .update({
          custom_domain_verified_at: new Date().toISOString(),
          last_dns_check_at: new Date().toISOString(),
        })
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
      .update({ custom_domain: null, custom_domain_verified_at: null, custom_domain_verify_token: null, last_dns_check_at: null })
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
 */
export const resolveHost = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const rawHost = (getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "").toLowerCase();
  if (!rawHost) return { tenantSlug: null as string | null, host: "" };
  const host = rawHost.split(":")[0];

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
