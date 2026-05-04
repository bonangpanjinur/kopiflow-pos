import { Router, type IRouter } from "express";
import { getSupabaseAdmin } from "../../lib/supabase-admin";

const router: IRouter = Router();

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
  const fromEnv = process.env["CRON_SECRET"];
  if (fromEnv) return fromEnv;
  const { data } = await getSupabaseAdmin()
    .from("billing_settings")
    .select("cron_secret")
    .eq("id", 1)
    .maybeSingle();
  return (data?.cron_secret as string | null) ?? null;
}

interface CronSummary {
  expired_plans: number;
  expired_invoices: number;
  domains_checked: number;
  domains_unverified: number;
  reminders: Record<string, number>;
  errors: string[];
}

async function runMaintenance(): Promise<CronSummary> {
  const db = getSupabaseAdmin();
  const t0 = Date.now();
  const summary: CronSummary = {
    expired_plans: 0,
    expired_invoices: 0,
    domains_checked: 0,
    domains_unverified: 0,
    reminders: {},
    errors: [],
  };

  const { data: runRow } = await db
    .from("cron_runs")
    .insert({ job_name: "plan-maintenance", status: "running" })
    .select("id")
    .single();
  const runId = runRow?.id as string | undefined;

  async function updateRun(patch: Record<string, unknown>) {
    if (!runId) return;
    await db.from("cron_runs").update(patch).eq("id", runId);
  }

  try {
    // 1. Expire overdue Pro plans
    const { data: expired, error: expErr } = await db.rpc("expire_overdue_plans");
    if (expErr) summary.errors.push("expire_overdue_plans: " + expErr.message);
    else {
      const arr = (expired as Array<{ shop_id: string }> | null) ?? [];
      summary.expired_plans = arr.length;
      for (const row of arr) {
        await db.rpc("log_system_event", {
          _event_type: "plan_downgrade",
          _shop_id: row.shop_id,
          _payload: { source: "cron" },
          _notes: "auto downgrade pro→free",
        });
      }
    }

    // 2. Expire overdue invoices
    const { data: invoices, error: invErr } = await db.rpc("expire_overdue_invoices");
    if (invErr) summary.errors.push("expire_overdue_invoices: " + invErr.message);
    else summary.expired_invoices = ((invoices as unknown[] | null) ?? []).length;

    // 3. DNS domain verification checks
    const { data: shops, error: shopErr } = await db
      .from("coffee_shops")
      .select("id, custom_domain, custom_domain_verified_at, dns_txt_token")
      .not("custom_domain", "is", null)
      .not("custom_domain_verified_at", "is", null);

    if (shopErr) {
      summary.errors.push("domain_check_fetch: " + shopErr.message);
    } else {
      for (const s of (shops as Array<{
        id: string;
        custom_domain: string | null;
        custom_domain_verified_at: string | null;
        dns_txt_token: string | null;
      }> | null) ?? []) {
        if (!s.custom_domain || !s.dns_txt_token) continue;
        summary.domains_checked++;
        const txts = await dohTxt(s.custom_domain);
        const verified = txts.some((t) => t.includes(s.dns_txt_token!));
        if (!verified) {
          await db
            .from("coffee_shops")
            .update({ custom_domain_verified_at: null })
            .eq("id", s.id);
          await db.rpc("log_system_event", {
            _event_type: "domain_auto_unverify",
            _shop_id: s.id,
            _payload: { domain: s.custom_domain, txt_found: txts.slice(0, 3) },
            _notes: "auto-unverified by cron",
          });
          summary.domains_unverified++;
        } else {
          await db
            .from("coffee_shops")
            .update({ last_dns_check_at: new Date().toISOString() })
            .eq("id", s.id);
        }
      }
    }

    // 4. Generate owner reminders
    const { data: rem, error: remErr } = await db.rpc("generate_owner_reminders");
    if (remErr) summary.errors.push("generate_owner_reminders: " + remErr.message);
    else summary.reminders = (rem as Record<string, number> | null) ?? {};

    await updateRun({
      status: summary.errors.length > 0 ? "error" : "success",
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      result: summary,
      error_message: summary.errors.join(" | ") || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.errors.push("fatal: " + msg);
    await updateRun({
      status: "error",
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      result: summary,
      error_message: msg,
    });
  }

  return summary;
}

router.post("/cron/plan-maintenance", async (req, res) => {
  const provided = req.headers["x-cron-secret"] as string | undefined;
  let expected: string | null;
  try {
    expected = await getCronSecret();
  } catch (e) {
    res.status(503).json({ error: "supabase_unavailable", detail: String(e) });
    return;
  }

  if (!expected) {
    res.status(503).json({ error: "cron_secret_not_configured" });
    return;
  }
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const summary = await runMaintenance();
    res.status(200).json({ ok: true, summary, ranAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "maintenance_failed", detail: String(e) });
  }
});

export default router;
