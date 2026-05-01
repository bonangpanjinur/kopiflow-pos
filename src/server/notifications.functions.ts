import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listMyNotifications = createServerFn({ method: "GET" })
  .handler(async (args) => {
    const { listMyNotifications: handler } = await import("./notifications.functions.server");
    return handler(args);
  });

export const markNotification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["read", "dismiss"]),
      })
      .parse(input),
  )
  .handler(async (args) => {
    const { markNotification: handler } = await import("./notifications.functions.server");
    return handler(args);
  });

export const dismissAllNotifications = createServerFn({ method: "POST" })
  .handler(async (args) => {
    const { dismissAllNotifications: handler } = await import("./notifications.functions.server");
    return handler(args);
  });
