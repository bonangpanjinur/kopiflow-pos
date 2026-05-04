import { supabase } from "@/integrations/supabase/client";

export type CashShift = {
  id: string;
  shop_id: string;
  outlet_id: string;
  opened_by: string;
  opened_at: string;
  opening_cash: number;
  closed_by: string | null;
  closed_at: string | null;
  closing_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  status: "open" | "closed";
  note: string | null;
};

export type CashMovement = {
  id: string;
  shift_id: string;
  type: "in" | "out" | "sale" | "refund" | "opening" | "closing";
  amount: number;
  note: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
};

export async function getActiveShift(outletId: string): Promise<CashShift | null> {
  const { data } = await supabase
    .from("cash_shifts")
    .select("*")
    .eq("outlet_id", outletId)
    .eq("status", "open")
    .maybeSingle();
  return (data as CashShift | null) ?? null;
}

export async function openShift(outletId: string, openingCash: number) {
  const { data, error } = await supabase.rpc("open_shift", {
    _outlet_id: outletId,
    _opening_cash: openingCash,
  });
  if (error) throw error;
  return data as string;
}

export async function closeShift(
  shiftId: string,
  closingCash: number,
  note?: string,
) {
  const { data, error } = await supabase.rpc("close_shift", {
    _shift_id: shiftId,
    _closing_cash: closingCash,
    _note: note ?? undefined,
  });
  if (error) throw error;
  return data as {
    shift_id: string;
    opening_cash: number;
    cash_sales: number;
    cash_in: number;
    cash_out: number;
    refunds: number;
    expected_cash: number;
    closing_cash: number;
    variance: number;
  };
}

export async function addCashMovement(
  shiftId: string,
  type: "in" | "out",
  amount: number,
  note?: string,
) {
  const { error } = await supabase.from("cash_movements").insert({
    shift_id: shiftId,
    type,
    amount,
    note: note ?? null,
  });
  if (error) throw error;
}

export async function refundOrder(
  orderId: string,
  amount: number,
  reason: string,
  method: "cash" | "qris" | "transfer",
) {
  const { data, error } = await supabase.rpc("refund_order", {
    _order_id: orderId,
    _amount: amount,
    _reason: reason,
    _method: method,
  });
  if (error) throw error;
  return data as string;
}
