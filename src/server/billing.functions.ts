import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function genInvoiceNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${ymd}-${rnd}`;
}

export const createPlanInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ planCode: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: shop } = await supabase
      .from("coffee_shops")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!shop) throw new Error("shop_not_found");

    const { data: plan } = await supabase
      .from("plans")
      .select("id, price_idr, is_active")
      .eq("code", data.planCode)
      .maybeSingle();
    if (!plan || !plan.is_active) throw new Error("plan_not_available");

    const invoice_no = genInvoiceNo();
    const { data: inv, error } = await supabase
      .from("plan_invoices")
      .insert({
        shop_id: shop.id,
        plan_id: plan.id,
        invoice_no,
        amount_idr: plan.price_idr,
        status: "pending",
      })
      .select("id, invoice_no")
      .single();
    if (error) throw new Error(error.message);
    return inv;
  });

export const submitPaymentProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoiceId: z.string().uuid(),
      proofUrl: z.string().url().max(2048),
      method: z.string().min(1).max(32).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("plan_invoices")
      .update({
        payment_proof_url: data.proofUrl,
        payment_method: data.method ?? "bank_transfer",
        status: "awaiting_review",
      })
      .eq("id", data.invoiceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("approve_plan_invoice", { _invoice_id: data.invoiceId });
    if (error) throw new Error(error.message);
    return result as unknown;
  });

export const rejectInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invoiceId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("reject_plan_invoice", {
      _invoice_id: data.invoiceId,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const expireOverduePlans = createServerFn({ method: "POST" }).handler(async () => {
  const { error } = await supabaseAdmin
    .from("coffee_shops")
    .update({ plan: "free" })
    .eq("plan", "pro")
    .lt("plan_expires_at", new Date().toISOString());
  if (error) throw new Error(error.message);
  return { ok: true };
});
