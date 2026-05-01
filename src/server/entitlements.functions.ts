import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (args) => {
    const { getEntitlements: handler } = await import("./entitlements.functions.server");
    return handler(args);
  });

export const setShopTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ themeKey: z.string().min(1).max(64) }).parse(input))
  .handler(async (args) => {
    const { setShopTheme: handler } = await import("./entitlements.functions.server");
    return handler(args);
  });

export const getPublicShopTheme = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async (args) => {
    const { getPublicShopTheme: handler } = await import("./entitlements.functions.server");
    return handler(args);
  });
