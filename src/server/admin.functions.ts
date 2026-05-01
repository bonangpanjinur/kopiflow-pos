import { createServerFn } from "@tanstack/react-start";

export const runPlanMaintenance = createServerFn({ method: "POST" })
  .handler(async () => {
    const { runPlanMaintenance: handler } = await import("./admin.functions.server");
    return handler();
  });
