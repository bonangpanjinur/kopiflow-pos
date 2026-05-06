// Stub payment session creator.
// Returns a manual-transfer payload so the app is usable end-to-end without a real PSP.
// Replace this with Midtrans/Stripe integration when keys are available.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PaymentRequest {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as PaymentRequest;
    if (!body?.orderId || !body?.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "invalid_request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Read billing settings to expose bank info to the client
    const { data: billing } = await admin
      .from("billing_settings")
      .select("bank_name, account_no, account_name, instructions, qris_image_url")
      .eq("id", 1)
      .maybeSingle();

    // Mark order as awaiting manual payment
    await admin
      .from("orders")
      .update({ payment_status: "pending", payment_method: "transfer" })
      .eq("id", body.orderId);

    const token = `manual_${body.orderId}_${Date.now()}`;
    return new Response(
      JSON.stringify({
        token,
        provider: "manual",
        redirect_url: null,
        instructions:
          billing?.instructions ??
          "Silakan transfer manual ke rekening berikut, lalu unggah bukti pembayaran.",
        bank: billing
          ? {
              bank_name: billing.bank_name,
              account_no: billing.account_no,
              account_name: billing.account_name,
              qris_image_url: billing.qris_image_url,
            }
          : null,
        amount: body.amount,
        order_id: body.orderId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-payment error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
