import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const UpdateMinMonthsInput = z.object({
  plan_id: z.string().uuid(),
  item_key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_.-]+$/),
  kind: z.enum(["feature", "theme"]),
  new_value: z.number().int().min(0).max(120),
  expected_old_value: z.number().int().min(0).max(120),
});

const UndoMinMonthsInput = z.object({
  plan_id: z.string().uuid(),
  item_key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_.-]+$/),
  kind: z.enum(["feature", "theme"]),
  restore_value: z.number().int().min(0).max(120),
  expected_current: z.number().int().min(0).max(120),
});

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;

type RetryStatus = { attempt: number; maxRetries: number };
type RetryCallback = (status: RetryStatus) => void;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, _onRetry?: RetryCallback): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      const isTransient =
        err instanceof Error &&
        (/fetch|network|timeout|ECONNRESET|socket hang up/i.test(err.message));
      if (!isTransient) throw err;
      _onRetry?.({ attempt: attempt + 1, maxRetries: retries });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
}

async function readCurrentValue(
  supabase: Parameters<typeof updateMinMonths>[0] extends { data: infer D } ? never : any,
  kind: "feature" | "theme",
  plan_id: string,
  item_key: string,
): Promise<number> {
  if (kind === "feature") {
    const { data: row, error } = await supabase
      .from("plan_features").select("requires_min_months")
      .eq("plan_id", plan_id).eq("feature_key", item_key).single();
    if (error) throw new Error(error.message);
    return (row?.requires_min_months as number | null) ?? 0;
  } else {
    const { data: row, error } = await supabase
      .from("plan_themes").select("requires_min_months")
      .eq("plan_id", plan_id).eq("theme_key", item_key).single();
    if (error) throw new Error(error.message);
    return (row?.requires_min_months as number | null) ?? 0;
  }
}

async function writeAudit(
  supabase: any,
  userId: string,
  eventType: string,
  plan_id: string,
  kind: string,
  item_key: string,
  oldValue: number,
  newValue: number,
) {
  try {
    await supabase.from("system_audit").insert({
      event_type: eventType,
      actor_id: userId,
      payload: { plan_id, kind, item_key, old_value: oldValue, new_value: newValue },
      notes: `requires_min_months: ${oldValue} → ${newValue}`,
    });
  } catch {
    // best-effort
  }
}

// ── Update with optimistic concurrency ──
export const updateMinMonths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateMinMonthsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { plan_id, item_key, kind, new_value, expected_old_value } = data;

    // 1. Read current value & check concurrency
    const actualCurrent = await withRetry(() => readCurrentValue(supabase, kind, plan_id, item_key));

    if (actualCurrent !== expected_old_value) {
      return {
        success: false,
        conflict: true,
        changed: false,
        old_value: actualCurrent,
        new_value,
        message: `Nilai telah berubah oleh pengguna lain (sekarang: ${actualCurrent}, Anda lihat: ${expected_old_value})`,
      };
    }

    if (actualCurrent === new_value) {
      return { success: true, conflict: false, changed: false, old_value: actualCurrent, new_value };
    }

    // 2. Update with retry (idempotent)
    let retryCount = 0;
    const doUpdate = async () => {
      if (kind === "feature") {
        const { error } = await supabase.from("plan_features")
          .update({ requires_min_months: new_value })
          .eq("plan_id", plan_id).eq("feature_key", item_key);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("plan_themes")
          .update({ requires_min_months: new_value })
          .eq("plan_id", plan_id).eq("theme_key", item_key);
        if (error) throw new Error(error.message);
      }
    };

    await withRetry(doUpdate, MAX_RETRIES, ({ attempt }) => { retryCount = attempt; });

    // 3. Audit log
    await writeAudit(supabase, userId, "plan_matrix_update", plan_id, kind, item_key, actualCurrent, new_value);

    return {
      success: true,
      conflict: false,
      changed: true,
      old_value: actualCurrent,
      new_value,
      retries_used: retryCount,
    };
  });

// ── Undo (restore old value with concurrency check) ──
export const undoMinMonths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UndoMinMonthsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { plan_id, item_key, kind, restore_value, expected_current } = data;

    // Concurrency check
    const actualCurrent = await withRetry(() => readCurrentValue(supabase, kind, plan_id, item_key));

    if (actualCurrent !== expected_current) {
      return {
        success: false,
        conflict: true,
        message: `Nilai telah berubah lagi (sekarang: ${actualCurrent}). Undo dibatalkan.`,
      };
    }

    if (actualCurrent === restore_value) {
      return { success: true, conflict: false, changed: false };
    }

    const doUpdate = async () => {
      if (kind === "feature") {
        const { error } = await supabase.from("plan_features")
          .update({ requires_min_months: restore_value })
          .eq("plan_id", plan_id).eq("feature_key", item_key);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("plan_themes")
          .update({ requires_min_months: restore_value })
          .eq("plan_id", plan_id).eq("theme_key", item_key);
        if (error) throw new Error(error.message);
      }
    };

    await withRetry(doUpdate);
    await writeAudit(supabase, userId, "plan_matrix_undo", plan_id, kind, item_key, actualCurrent, restore_value);

    return { success: true, conflict: false, changed: true, old_value: actualCurrent, new_value: restore_value };
  });

// ── Fetch audit logs for export ──
const AuditExportInput = z.object({
  plan_id: z.string().uuid().optional(),
  from_date: z.string().min(1).max(30),
  to_date: z.string().min(1).max(30),
});

export const fetchMatrixAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AuditExportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { plan_id, from_date, to_date } = data;

    let q = supabase
      .from("system_audit")
      .select("id, event_type, actor_id, payload, notes, created_at")
      .in("event_type", ["plan_matrix_update", "plan_matrix_undo"])
      .gte("created_at", `${from_date}T00:00:00Z`)
      .lte("created_at", `${to_date}T23:59:59Z`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (plan_id) {
      q = q.contains("payload", { plan_id });
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Enrich with plan names
    const planIds = [...new Set((rows ?? []).map((r: any) => (r.payload as any)?.plan_id).filter(Boolean))];
    const { data: plans } = await supabase.from("plans").select("id, name, code").in("id", planIds);
    const planMap = new Map((plans ?? []).map((p: any) => [p.id, p]));

    return (rows ?? []).map((r: any) => {
      const p = r.payload as any;
      const plan = planMap.get(p?.plan_id);
      return {
        tanggal: new Date(r.created_at).toLocaleString("id-ID"),
        event: r.event_type === "plan_matrix_undo" ? "UNDO" : "UPDATE",
        plan_name: plan?.name ?? p?.plan_id ?? "-",
        plan_code: plan?.code ?? "-",
        kind: p?.kind ?? "-",
        item_key: p?.item_key ?? "-",
        old_value: p?.old_value ?? "-",
        new_value: p?.new_value ?? "-",
        actor_id: r.actor_id?.slice(0, 8) ?? "-",
        notes: r.notes ?? "",
      };
    });
  });
