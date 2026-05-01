import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShopDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getShopDetail: handler } = await import("./admin-shops.functions.server");
    return handler({ data, context });
  });

export const setShopPlanManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        plan: z.enum(["free", "pro"]),
        expiresAt: z.string().datetime().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setShopPlanManual: handler } = await import("./admin-shops.functions.server");
    return handler({ data, context });
  });

export const suspendShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        reason: z.string().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { suspendShop: handler } = await import("./admin-shops.functions.server");
    return handler({ data, context });
  });

export const unsuspendShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { unsuspendShop: handler } = await import("./admin-shops.functions.server");
    return handler({ data, context });
  });

export const sendOwnerPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { sendOwnerPasswordReset: handler } = await import("./admin-shops.functions.server");
    return handler({ data, context });
  });
