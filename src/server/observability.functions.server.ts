import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

export const listCronRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("cron_runs")
      .select("id, job_name, started_at, finished_at, status, duration_ms, result, error_message")
      .order("started_at", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });

export const listSystemAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(100),
        eventType: z.string().optional(),
        shopId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin
      .from("system_audit")
      .select("id, created_at, event_type, shop_id, actor_id, payload, notes")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.eventType) q = q.eq("event_type", data.eventType);
    if (data.shopId) q = q.eq("shop_id", data.shopId);
    const { data: rows } = await q;
    return rows ?? [];
  });
