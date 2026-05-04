import { supabase } from "@/integrations/supabase/client";

export async function listCronRuns({ data }: { data: { limit: number } }) {
  const { data: rows } = await supabase.from("cron_runs" as any).select("id, job_name, started_at, finished_at, status, duration_ms, result, error_message").order("started_at", { ascending: false }).limit(data.limit);
  return rows ?? [];
}

export async function listSystemAudit({ data }: { data: { limit: number; eventType?: string; shopId?: string } }) {
  let q = (supabase.from("system_audit" as any) as any).select("id, created_at, event_type, shop_id, actor_id, payload, notes").order("created_at", { ascending: false }).limit(data.limit);
  if (data.eventType) q = q.eq("event_type", data.eventType);
  if (data.shopId) q = q.eq("shop_id", data.shopId);
  const { data: rows } = await q;
  return rows ?? [];
}
