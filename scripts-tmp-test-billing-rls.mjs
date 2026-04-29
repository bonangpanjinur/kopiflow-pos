import { createClient } from "@supabase/supabase-js";

const URL = "https://rujzvitsvyfamemfprgb.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anp2aXRzdnlmYW1lbWZwcmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzY0MDQsImV4cCI6MjA5MzAxMjQwNH0.TA_uIwhIvxpI2kRiQbae0OpKBQhIah8G0_lCn4o73dI";

const results = [];
const log = (name, pass, info) => {
  results.push({ name, pass, info });
  console.log(`${pass ? "✅" : "❌"} ${name}${info ? " — " + info : ""}`);
};

// ---- 1) ANON ----
{
  const sb = createClient(URL, ANON);
  const r1 = await sb.from("billing_settings").select("*");
  log("anon SELECT billing_settings returns 0 rows", (r1.data?.length ?? 0) === 0, `rows=${r1.data?.length ?? 0} err=${r1.error?.code ?? "-"}`);

  const r2 = await sb.from("billing_settings").select("cron_secret");
  const leaked = (r2.data ?? []).some((row) => row.cron_secret);
  log("anon cannot read cron_secret", !leaked, `rows=${r2.data?.length ?? 0}`);

  const r3 = await sb.from("billing_settings").update({ cron_secret: "hacked_anon" }).eq("id", 1).select();
  log("anon UPDATE billing_settings is rejected/no-op", (r3.data?.length ?? 0) === 0, `err=${r3.error?.code ?? "-"} rows=${r3.data?.length ?? 0}`);

  const r4 = await sb.from("billing_settings").insert({ id: 999, cron_secret: "x" }).select();
  log("anon INSERT billing_settings is rejected", (r4.data?.length ?? 0) === 0, `err=${r4.error?.code ?? "-"}`);

  const r5 = await sb.rpc("get_billing_settings_public");
  log("anon RPC get_billing_settings_public works", !r5.error, `err=${r5.error?.message ?? "-"} rows=${Array.isArray(r5.data) ? r5.data.length : "?"}`);
}

// ---- 2) AUTHENTICATED non-admin ----
{
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const email = `rls-test-${Date.now()}@example.com`;
  const password = "TestPassw0rd!xyz";
  const su = await sb.auth.signUp({ email, password });
  if (su.error) {
    log("signup test user", false, su.error.message);
  } else {
    // If email confirmation required, sign-in won't have a session yet
    let session = su.data.session;
    if (!session) {
      const si = await sb.auth.signInWithPassword({ email, password });
      session = si.data.session ?? null;
      if (si.error) console.log("  (sign-in error: " + si.error.message + ")");
    }
    log("authenticated session established", !!session, session ? `uid=${session.user.id}` : "no session (email confirm?) — auth tests skipped");

    if (session) {
      const r1 = await sb.from("billing_settings").select("*");
      log("auth(non-admin) SELECT billing_settings returns 0 rows", (r1.data?.length ?? 0) === 0, `rows=${r1.data?.length ?? 0} err=${r1.error?.code ?? "-"}`);

      const r2 = await sb.from("billing_settings").select("cron_secret");
      const leaked = (r2.data ?? []).some((row) => row.cron_secret);
      log("auth(non-admin) cannot read cron_secret", !leaked, `rows=${r2.data?.length ?? 0}`);

      const r3 = await sb.from("billing_settings").update({ cron_secret: "hacked_auth" }).eq("id", 1).select();
      log("auth(non-admin) UPDATE billing_settings is rejected/no-op", (r3.data?.length ?? 0) === 0, `err=${r3.error?.code ?? "-"} rows=${r3.data?.length ?? 0}`);

      const r4 = await sb.from("billing_settings").insert({ id: 998, cron_secret: "x" }).select();
      log("auth(non-admin) INSERT billing_settings is rejected", (r4.data?.length ?? 0) === 0, `err=${r4.error?.code ?? "-"}`);

      const r5 = await sb.rpc("get_billing_settings_public");
      log("auth(non-admin) RPC get_billing_settings_public works", !r5.error, `err=${r5.error?.message ?? "-"}`);
    }

    await sb.auth.signOut();
  }
}

// ---- 3) Verify cron_secret was not actually changed by attacks ----
// We can't read it as non-admin (that's the whole point). Use service role via psql if available.

const failed = results.filter((r) => !r.pass);
console.log("\n" + "=".repeat(60));
console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
process.exit(failed.length === 0 ? 0 : 1);
