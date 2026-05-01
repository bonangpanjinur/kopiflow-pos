import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getShopDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getShopDetail: handler } = await import("./admin-shops.functions.server");
    return handler({ data });
  });

export const setShopPlanManual = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        plan: z.enum(["free", "pro"]),
        expiresAt: z.string().datetime().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { setShopPlanManual: handler } = await import("./admin-shops.functions.server");
    return handler({ data });
  });

export const suspendShop = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        reason: z.string().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { suspendShop: handler } = await import("./admin-shops.functions.server");
    return handler({ data });
  });

export const unsuspendShop = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { unsuspendShop: handler } = await import("./admin-shops.functions.server");
    return handler({ data });
  });

export const sendOwnerPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { sendOwnerPasswordReset: handler } = await import("./admin-shops.functions.server");
    return handler({ data });
  });
