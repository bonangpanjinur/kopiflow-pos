import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DOMAIN_RE = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

export const requestCustomDomain = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ domain: z.string().min(3).max(253).regex(DOMAIN_RE) }).parse(input),
  )
  .handler(async (args) => {
    const { requestCustomDomain: handler } = await import("./domain.functions.server");
    return handler(args);
  });

export const verifyCustomDomain = createServerFn({ method: "POST" })
  .handler(async (args) => {
    const { verifyCustomDomain: handler } = await import("./domain.functions.server");
    return handler(args);
  });

export const removeCustomDomain = createServerFn({ method: "POST" })
  .handler(async (args) => {
    const { removeCustomDomain: handler } = await import("./domain.functions.server");
    return handler(args);
  });
