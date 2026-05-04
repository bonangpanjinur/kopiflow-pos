import { supabase } from "@/integrations/supabase/client";

export async function updateMinMonths({ data }: { data: { plan_id: string; item_key: string; kind: string; new_value: number; expected_old_value: number } }) {
  const { error } = await supabase.rpc("admin_update_min_months" as any, { _plan_id: data.plan_id, _item_key: data.item_key, _kind: data.kind, _new_value: data.new_value, _expected_old_value: data.expected_old_value });
  if (error) throw error;
  return { ok: true };
}

export async function undoMinMonths({ data }: { data: { plan_id: string; item_key: string; kind: string; restore_value: number; expected_current: number } }) {
  const { error } = await supabase.rpc("admin_undo_min_months" as any, { _plan_id: data.plan_id, _item_key: data.item_key, _kind: data.kind, _restore_value: data.restore_value, _expected_current: data.expected_current });
  if (error) throw error;
  return { ok: true };
}

export async function fetchMatrixAuditLogs({ data }: { data: { plan_id?: string; from_date: string; to_date: string } }) {
  let q = (supabase.from("plan_matrix_audit" as any) as any).select("*").gte("created_at", data.from_date).lte("created_at", data.to_date).order("created_at", { ascending: false });
  if (data.plan_id) q = q.eq("plan_id", data.plan_id);
  const { data: rows } = await q;
  return rows ?? [];
}
