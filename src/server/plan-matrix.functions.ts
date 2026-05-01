import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const UpdateMinMonthsInput = z.object({
  plan_id: z.string().uuid(),
  item_key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_.-]+$/),
  kind: z.enum(["feature", "theme"]),
  new_value: z.number().int().min(0).max(120),
});

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      const isTransient =
        err instanceof Error &&
        (/fetch|network|timeout|ECONNRESET|socket hang up/i.test(err.message));
      if (!isTransient) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
}

export const updateMinMonths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateMinMonthsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { plan_id, item_key, kind, new_value } = data;

    // 1. Read current value
    const table = kind === "feature" ? "plan_features" : "plan_themes";
    const keyCol = kind === "feature" ? "feature_key" : "theme_key";

    const readCurrent = async () => {
      const { data: row, error } = await supabase
        .from(table)
        .select("requires_min_months")
        .eq("plan_id", plan_id)
        .eq(keyCol, item_key)
        .single();
      if (error) throw new Error(error.message);
      return (row?.requires_min_months as number | null) ?? 0;
    };

    const oldValue = await withRetry(readCurrent);

    if (oldValue === new_value) {
      return { success: true, old_value: oldValue, new_value, changed: false };
    }

    // 2. Update with retry (idempotent — same value each retry)
    const doUpdate = async () => {
      const { error } = await supabase
        .from(table)
        .update({ requires_min_months: new_value })
        .eq("plan_id", plan_id)
        .eq(keyCol, item_key);
      if (error) throw new Error(error.message);
    };

    await withRetry(doUpdate);

    // 3. Audit log (best-effort, don't fail the whole operation)
    try {
      await supabase.from("system_audit").insert({
        event_type: "plan_matrix_update",
        actor_id: userId,
        payload: {
          plan_id,
          kind,
          item_key,
          old_value: oldValue,
          new_value,
        },
        notes: `requires_min_months: ${oldValue} → ${new_value}`,
      });
    } catch {
      // audit log failure is non-critical
    }

    return { success: true, old_value: oldValue, new_value, changed: true };
  });
