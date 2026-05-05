import { supabase } from "@/integrations/supabase/client";
import type {
  Reservation,
  ReservationSlot,
  ReservationSettings,
  CreateReservationRequest,
  UpdateReservationRequest,
} from "@/types/stage4";

/**
 * Get reservation settings for an outlet
 */
export async function getReservationSettings(
  outletId: string
): Promise<ReservationSettings | null> {
  const { data, error } = await supabase
    .from("reservation_settings")
    .select("*")
    .eq("outlet_id", outletId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching reservation settings:", error);
    return null;
  }

  return data as ReservationSettings | null;
}

/**
 * Get available reservation slots for a date range
 */
export async function getAvailableSlots(
  outletId: string,
  startDate: string,
  endDate: string
): Promise<ReservationSlot[]> {
  const { data, error } = await supabase
    .from("reservation_slots")
    .select("*")
    .eq("outlet_id", outletId)
    .gte("date", startDate)
    .lte("date", endDate)
    .gt("available_tables", 0)
    .order("date")
    .order("time");

  if (error) {
    console.error("Error fetching reservation slots:", error);
    return [];
  }

  return (data || []) as ReservationSlot[];
}

/**
 * Check table availability for a specific time slot
 */
export async function checkTableAvailability(
  outletId: string,
  reservationDate: string,
  reservationTime: string,
  partySize: number,
  excludeReservationId?: string
): Promise<number> {
  const { data, error } = await supabase.rpc("check_table_availability", {
    _outlet_id: outletId,
    _reservation_date: reservationDate,
    _reservation_time: reservationTime,
    _party_size: partySize,
    _exclude_reservation_id: excludeReservationId || null,
  });

  if (error) {
    console.error("Error checking table availability:", error);
    return 0;
  }

  return (data?.[0]?.available_count || 0) as number;
}

/**
 * Create a new reservation
 */
export async function createReservation(
  shopId: string,
  request: CreateReservationRequest
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      shop_id: shopId,
      outlet_id: request.outlet_id,
      customer_name: request.customer_name,
      customer_phone: request.customer_phone || null,
      customer_email: request.customer_email || null,
      reservation_date: request.reservation_date,
      reservation_time: request.reservation_time,
      party_size: request.party_size,
      special_requests: request.special_requests || null,
      table_id: request.table_id || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating reservation:", error);
    return null;
  }

  return data as Reservation;
}

/**
 * Update an existing reservation
 */
export async function updateReservation(
  reservationId: string,
  request: UpdateReservationRequest
): Promise<Reservation | null> {
  const updateData: Record<string, any> = {};

  if (request.status !== undefined) updateData.status = request.status;
  if (request.table_id !== undefined) updateData.table_id = request.table_id;
  if (request.special_requests !== undefined)
    updateData.special_requests = request.special_requests;
  if (request.notes !== undefined) updateData.notes = request.notes;
  if (request.cancelled_reason !== undefined)
    updateData.cancelled_reason = request.cancelled_reason;

  if (request.status === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("reservations")
    .update(updateData)
    .eq("id", reservationId)
    .select()
    .single();

  if (error) {
    console.error("Error updating reservation:", error);
    return null;
  }

  return data as Reservation;
}

/**
 * Get reservations for a shop/outlet
 */
export async function getReservations(
  outletId: string,
  status?: string,
  startDate?: string,
  endDate?: string
): Promise<Reservation[]> {
  let query = supabase
    .from("reservations")
    .select("*")
    .eq("outlet_id", outletId)
    .order("reservation_date")
    .order("reservation_time");

  if (status) {
    query = query.eq("status", status);
  }

  if (startDate) {
    query = query.gte("reservation_date", startDate);
  }

  if (endDate) {
    query = query.lte("reservation_date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching reservations:", error);
    return [];
  }

  return (data || []) as Reservation[];
}

/**
 * Get a single reservation by ID
 */
export async function getReservationById(
  reservationId: string
): Promise<Reservation | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching reservation:", error);
    return null;
  }

  return data as Reservation | null;
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(
  reservationId: string,
  reason: string
): Promise<Reservation | null> {
  return updateReservation(reservationId, {
    status: "cancelled",
    cancelled_reason: reason,
  });
}

/**
 * Confirm a pending reservation
 */
export async function confirmReservation(
  reservationId: string
): Promise<Reservation | null> {
  return updateReservation(reservationId, {
    status: "confirmed",
  });
}

/**
 * Generate reservation slots for a date range
 */
export async function generateReservationSlots(
  outletId: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  const { error } = await supabase.rpc("generate_reservation_slots", {
    _outlet_id: outletId,
    _start_date: startDate,
    _end_date: endDate,
  });

  if (error) {
    console.error("Error generating reservation slots:", error);
    return false;
  }

  return true;
}

/**
 * Check if reservation is within cancellation policy
 */
export function canCancelReservation(
  reservationDateTime: Date,
  cancellationPolicyHours: number
): boolean {
  const now = new Date();
  const hoursUntilReservation =
    (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilReservation >= cancellationPolicyHours;
}

/**
 * Format reservation time for display
 */
export function formatReservationTime(
  date: string,
  time: string
): string {
  const dateObj = new Date(`${date}T${time}`);
  return dateObj.toLocaleString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
