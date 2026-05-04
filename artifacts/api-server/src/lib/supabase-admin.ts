import { createClient } from "@supabase/supabase-js";

type SupabaseAdminClient = ReturnType<typeof createClient>;

let _client: SupabaseAdminClient | undefined;

export function getSupabaseAdmin(): SupabaseAdminClient {
  if (_client) return _client;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    const missing = [...(!url ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_SERVICE_ROLE_KEY"] : [])];
    throw new Error(`Missing Supabase env var(s): ${missing.join(", ")}. Set them in your environment.`);
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
