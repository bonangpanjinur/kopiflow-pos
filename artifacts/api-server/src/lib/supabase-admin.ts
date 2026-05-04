import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

let _client: AnyClient | undefined;

export function getSupabaseAdmin(): AnyClient {
  if (_client) return _client;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    const missing = [...(!url ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_SERVICE_ROLE_KEY"] : [])];
    throw new Error(`Missing Supabase env var(s): ${missing.join(", ")}. Set them in your environment.`);
  }

  // Using `any` generic so all .from() / .rpc() calls accept plain objects
  // without requiring the generated Database type (which lives in kopihub).
  _client = createClient<any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
