import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listCronRuns = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { listCronRuns: handler } = await import("./observability.functions.server");
    return handler({ data });
  });

export const listSystemAudit = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(100),
        eventType: z.string().optional(),
        shopId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { listSystemAudit: handler } = await import("./observability.functions.server");
    return handler({ data });
  });
