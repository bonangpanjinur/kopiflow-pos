import { supabase } from "@/integrations/supabase/client";

export async function listMyNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("notifications" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function markNotification({ data }: { data: { id: string; action: "read" | "dismiss" } }) {
  const update = data.action === "read" ? { read_at: new Date().toISOString() } : { dismissed_at: new Date().toISOString() };
  const { error } = await supabase.from("notifications" as any).update(update).eq("id", data.id);
  if (error) throw error;
  return { ok: true };
}

export async function dismissAllNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { error } = await supabase.from("notifications" as any).update({ dismissed_at: new Date().toISOString() }).eq("user_id", user.id).is("dismissed_at", null);
  if (error) throw error;
  return { ok: true };
}
