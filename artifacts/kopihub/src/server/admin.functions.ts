import { supabase } from "@/integrations/supabase/client";

export async function runPlanMaintenance() {
  const { error } = await supabase.rpc("run_plan_maintenance" as any);
  if (error) throw error;
  return { ok: true };
}
