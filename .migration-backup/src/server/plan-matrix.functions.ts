import { createServerFn } from "@tanstack/react-start";
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

const AuditExportInput = z.object({
  plan_id: z.string().uuid().optional(),
  from_date: z.string().min(1).max(30),
  to_date: z.string().min(1).max(30),
});

export const updateMinMonths = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UpdateMinMonthsInput.parse(data))
  .handler(async ({ data }) => {
    const { updateMinMonths: handler } = await import("./plan-matrix.functions.server");
    return handler({ data });
  });

export const undoMinMonths = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UndoMinMonthsInput.parse(data))
  .handler(async ({ data }) => {
    const { undoMinMonths: handler } = await import("./plan-matrix.functions.server");
    return handler({ data });
  });

export const fetchMatrixAuditLogs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AuditExportInput.parse(data))
  .handler(async ({ data }) => {
    const { fetchMatrixAuditLogs: handler } = await import("./plan-matrix.functions.server");
    return handler({ data });
  });
