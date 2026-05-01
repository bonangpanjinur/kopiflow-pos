import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const requestShopBackup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ shopId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requestShopBackup: handler } = await import("./backup.functions.server");
    return handler({ data });
  });

export const listShopBackups = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listShopBackups: handler } = await import("./backup.functions.server");
    return handler();
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ backupId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getBackupDownloadUrl: handler } = await import("./backup.functions.server");
    return handler({ data });
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ backupId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { deleteBackup: handler } = await import("./backup.functions.server");
    return handler({ data });
  });

export const upsertBackupSchedule = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      frequency: z.enum(["daily", "weekly", "monthly", "off"]),
      retentionDays: z.number().int().min(7).max(365),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { upsertBackupSchedule: handler } = await import("./backup.functions.server");
    return handler({ data });
  });

export const getBackupSchedule = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getBackupSchedule: handler } = await import("./backup.functions.server");
    return handler();
  });

export const requestCustomerExport = createServerFn({ method: "POST" })
  .handler(async () => {
    const { requestCustomerExport: handler } = await import("./backup.functions.server");
    return handler();
  });
