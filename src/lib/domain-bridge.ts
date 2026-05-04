import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DOMAIN_RE = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

export const requestCustomDomainBridge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ domain: z.string().min(3).max(253).regex(DOMAIN_RE) }).parse(input),
  )
  .handler(async (args) => {
    const { requestCustomDomain } = await import("../server/domain.functions.server");
    return requestCustomDomain(args);
  });

export const verifyCustomDomainBridge = createServerFn({ method: "POST" })
  .handler(async (args) => {
    const { verifyCustomDomain } = await import("../server/domain.functions.server");
    return verifyCustomDomain(args);
  });

export const removeCustomDomainBridge = createServerFn({ method: "POST" })
  .handler(async (args) => {
    const { removeCustomDomain } = await import("../server/domain.functions.server");
    return removeCustomDomain(args);
  });
