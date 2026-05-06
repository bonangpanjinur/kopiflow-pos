// Scheduled maintenance entrypoint.
// Triggers daily plan/invoice/notification maintenance via SQL functions.
// Protect with a bearer token (CRON_SECRET) or service-role key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided =
      req.headers.get("x-cron-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (cronSecret && provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const startedAt = new Date().toISOString();

    const [expired, staleInvoices, reminders] = await Promise.all([
      admin.rpc("expire_overdue_plans"),
      admin.rpc("expire_stale_pending_invoices"),
      admin.rpc("generate_owner_reminders"),
    ]);

    const result = {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      expired_plans: expired.data ?? null,
      stale_invoices: staleInvoices.data ?? null,
      reminders: reminders.data ?? null,
      errors: [expired.error, staleInvoices.error, reminders.error]
        .filter(Boolean)
        .map((e) => e?.message),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cron-maintenance error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
