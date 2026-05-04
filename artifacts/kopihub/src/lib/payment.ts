import { supabase } from "@/integrations/supabase/client";

export type PaymentRequest = {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
};

export async function createPaymentSession(req: PaymentRequest) {
  // In a real scenario, this would call a server-side function (Edge Function)
  // that interacts with Midtrans/Stripe API using a secret key.
  
  const { data, error } = await supabase.functions.invoke("create-payment", {
    body: req,
  });

  if (error) throw error;
  return data; // { token: "...", redirect_url: "..." }
}

export async function getPaymentStatus(orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();

  if (error) throw error;
  return data.payment_status;
}
