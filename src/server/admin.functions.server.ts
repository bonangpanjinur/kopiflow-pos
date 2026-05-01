import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("not_authorized");
}

/**
 * Trigger the cron maintenance task on demand from the super admin UI.
 * Calls the public cron endpoint with the configured secret.
 */
export const runPlanMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data: settings } = await supabaseAdmin
      .from("billing_settings")
      .select("cron_secret")
      .eq("id", 1)
      .maybeSingle();
    const secret = (settings?.cron_secret as string | null) ?? process.env.CRON_SECRET ?? null;
    if (!secret) throw new Error("cron_secret_not_set");

    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    if (!host) throw new Error("no_host");
    const url = `${proto}://${host}/api/public/cron/plan-maintenance`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": secret, "Content-Type": "application/json" },
      body: "{}",
    });
    const text = await res.text();
    let body: Record<string, string> = {};
    try {
      const parsed = JSON.parse(text);
      body = { result: JSON.stringify(parsed) };
    } catch {
      body = { raw: text };
    }
    if (!res.ok) throw new Error(`cron_failed_${res.status}: ${text.slice(0, 200)}`);
    return body;
  });
