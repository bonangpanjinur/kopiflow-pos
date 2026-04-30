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
    const { supabase, userId } = context;
    const { data: result, error } = await supabase.rpc("approve_plan_invoice", { _invoice_id: data.invoiceId });
    if (error) throw new Error(error.message);
    const r = result as { shop_id?: string; plan_expires_at?: string } | null;
    if (r?.shop_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("log_system_event", {
        _event_type: "plan_approve",
        _shop_id: r.shop_id,
        _payload: { invoice_id: data.invoiceId, actor_id: userId, plan_expires_at: r.plan_expires_at },
        _notes: "approved by super admin",
      });
      await supabaseAdmin.from("owner_notifications").insert({
        shop_id: r.shop_id,
        type: "invoice_approved",
        title: "Pembayaran disetujui",
        body: "Plan Pro Anda aktif sampai " + new Date(r.plan_expires_at ?? "").toLocaleDateString("id-ID"),
        link: "/app/billing",
        severity: "success",
      });
    }
    return { result };
  });

export const rejectInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invoiceId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv } = await supabase
      .from("plan_invoices")
      .select("shop_id")
      .eq("id", data.invoiceId)
      .maybeSingle();
    const { error } = await supabase.rpc("reject_plan_invoice", {
      _invoice_id: data.invoiceId,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    if (inv?.shop_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("log_system_event", {
        _event_type: "plan_reject",
        _shop_id: inv.shop_id,
        _payload: { invoice_id: data.invoiceId, reason: data.reason ?? null, actor_id: userId },
        _notes: data.reason ?? "rejected",
      });
      await supabaseAdmin.from("owner_notifications").insert({
        shop_id: inv.shop_id,
        type: "invoice_rejected",
        title: "Pembayaran ditolak",
        body: data.reason ?? "Mohon kirim ulang bukti pembayaran yang valid.",
        link: "/app/billing",
        severity: "danger",
      });
    }
    return { ok: true };
  });

export const cancelPlanInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("plan_invoices")
      .update({ status: "cancelled" })
      .eq("id", data.invoiceId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProofSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Authorization: super admin OR owner of the shop on the invoice
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const { data: inv, error } = await supabase
      .from("plan_invoices")
      .select("payment_proof_url, shop_id, coffee_shops!inner(owner_id)")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("invoice_not_found");
    const ownerId = (inv as unknown as { coffee_shops: { owner_id: string } }).coffee_shops?.owner_id;
    if (!isAdmin && ownerId !== userId) throw new Error("not_authorized");
    if (!inv.payment_proof_url) throw new Error("no_proof");

    // Extract storage path from stored URL (we store the path-like signed URL; fall back to parsing)
    let path = inv.payment_proof_url;
    const m = path.match(/payment-proofs\/(.+?)(\?|$)/);
    if (m) path = m[1];

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("payment-proofs")
      .createSignedUrl(path, 60 * 10);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
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
