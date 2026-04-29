import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// DoH lookup for TXT records via Cloudflare 1.1.1.1
async function dohTxt(name: string): Promise<string[]> {
  try {
    const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=TXT`;
    const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: Array<{ data: string }> };
    if (!json.Answer) return [];
    return json.Answer.map((a) => {
      const raw = a.data.trim();
      if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1).replace(/"\s+"/g, "");
      return raw;
    });
  } catch {
    return [];
  }
}

async function getCronSecret(): Promise<string | null> {
  const fromEnv = process.env.CRON_SECRET;
  if (fromEnv) return fromEnv;
  const { data } = await supabaseAdmin.from("billing_settings").select("cron_secret").eq("id", 1).maybeSingle();
  return (data?.cron_secret as string | null) ?? null;
}

async function runMaintenance() {
  const summary = {
    expired_plans: 0,
    expired_invoices: 0,
    domains_checked: 0,
    domains_unverified: 0,
    errors: [] as string[],
  };

  // 1. Expire overdue Pro plans (downgrade + unverify domain)
  const { data: expired, error: expErr } = await supabaseAdmin.rpc("expire_overdue_plans");
  if (expErr) summary.errors.push("expire_overdue_plans: " + expErr.message);
  else summary.expired_plans = (expired as Array<{ shop_id: string }> | null)?.length ?? 0;

  // 2. Expire stale pending invoices (>7 days, no proof)
  const { data: invCount, error: invErr } = await supabaseAdmin.rpc("expire_stale_pending_invoices");
  if (invErr) summary.errors.push("expire_stale_pending_invoices: " + invErr.message);
  else summary.expired_invoices = (invCount as number | null) ?? 0;

  // 3. Re-verify DNS for verified custom domains (throttle 6h)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: shops } = await supabaseAdmin
    .from("coffee_shops")
    .select("id, custom_domain, custom_domain_verify_token, last_dns_check_at")
    .not("custom_domain", "is", null)
    .not("custom_domain_verified_at", "is", null)
    .or(`last_dns_check_at.is.null,last_dns_check_at.lt.${sixHoursAgo}`)
    .limit(50);

  for (const s of shops ?? []) {
    if (!s.custom_domain || !s.custom_domain_verify_token) continue;
    summary.domains_checked++;
    const txts = await dohTxt(`_kopihub-verify.${s.custom_domain}`);
    const ok = txts.some((v) => v === s.custom_domain_verify_token);
    if (!ok) {
      await supabaseAdmin.rpc("auto_unverify_domain", {
        _shop_id: s.id,
        _reason: `dns recheck: TXT not found (got: ${txts.slice(0, 3).join(",") || "none"})`,
      });
      summary.domains_unverified++;
    } else {
      await supabaseAdmin
        .from("coffee_shops")
        .update({ last_dns_check_at: new Date().toISOString() })
        .eq("id", s.id);
    }
  }

  return summary;
}

export const Route = createFileRoute("/api/public/cron/plan-maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = await getCronSecret();
        if (!expected) {
          return new Response(JSON.stringify({ error: "cron_secret_not_configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const summary = await runMaintenance();
        return new Response(JSON.stringify({ ok: true, summary, ranAt: new Date().toISOString() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
