import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createPlanInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ planCode: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { createPlanInvoice: handler } = await import("./billing.functions.server");
    return handler({ data });
  });

export const submitPaymentProof = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      invoiceId: z.string().uuid(),
      proofUrl: z.string().url().max(2048),
      method: z.string().min(1).max(32).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { submitPaymentProof: handler } = await import("./billing.functions.server");
    return handler({ data });
  });

export const approveInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { approveInvoice: handler } = await import("./billing.functions.server");
    return handler({ data });
  });

export const rejectInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ invoiceId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { rejectInvoice: handler } = await import("./billing.functions.server");
    return handler({ data });
  });

export const cancelPlanInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { cancelPlanInvoice: handler } = await import("./billing.functions.server");
    return handler({ data });
  });

export const getProofSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getProofSignedUrl: handler } = await import("./billing.functions.server");
    return handler({ data });
  });
