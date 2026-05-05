import { supabase } from "@/integrations/supabase/client";

export async function requestShopBackup({ data }: { data: { shopId: string } }) {
  const { error } = await supabase.rpc("request_shop_backup" as any, { _shop_id: data.shopId });
  if (error) throw error;
  return { ok: true };
}

export async function listShopBackups() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data, error } = await supabase.from("shop_backups" as any).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBackupDownloadUrl({ data }: { data: { backupId: string } }) {
  const { data: row, error } = await supabase.from("shop_backups" as any).select("download_url").eq("id", data.backupId).maybeSingle();
  if (error) throw error;
  return { url: (row as any)?.download_url ?? null };
}

export async function deleteBackup({ data }: { data: { backupId: string } }) {
  const { error } = await supabase.from("shop_backups" as any).delete().eq("id", data.backupId);
  if (error) throw error;
  return { ok: true };
}

export async function upsertBackupSchedule({ data }: { data: { frequency: string; retentionDays: number } }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data: shop } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const { error } = await supabase.from("backup_schedules" as any).upsert({ shop_id: shop.id, frequency: data.frequency, retention_days: data.retentionDays });
  if (error) throw error;
  return { ok: true };
}

export async function getBackupSchedule() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data: shop } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) throw new Error("shop_not_found");
  const { data } = await supabase.from("backup_schedules" as any).select("*").eq("shop_id", shop.id).maybeSingle();
  return data ?? null;
}

export async function requestCustomerExport() {
  const { error } = await supabase.rpc("request_customer_export" as any);
  if (error) throw error;
  return { ok: true };
}
