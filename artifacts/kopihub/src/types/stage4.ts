// Stage 4: Reservations, Loyalty Enhancement, and Third-Party API Types

// ============================================
// RESERVATIONS
// ============================================

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Reservation {
  id: string;
  shop_id: string;
  outlet_id: string;
  table_id: string | null;
  customer_user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  reservation_date: string; // DATE format: YYYY-MM-DD
  reservation_time: string; // TIME format: HH:MM:SS
  party_size: number;
  status: ReservationStatus;
  special_requests: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

export interface ReservationSlot {
  id: string;
  shop_id: string;
  outlet_id: string;
  date: string;
  time: string;
  available_tables: number;
  created_at: string;
  updated_at: string;
}

export interface ReservationSettings {
  id: string;
  shop_id: string;
  outlet_id: string;
  is_enabled: boolean;
  advance_booking_days: number;
  min_party_size: number;
  max_party_size: number;
  slot_duration_minutes: number;
  slots_per_hour: number;
  opening_time: string;
  closing_time: string;
  allow_online_booking: boolean;
  require_deposit: boolean;
  deposit_percent: number;
  auto_confirm_booking: boolean;
  cancellation_policy_hours: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// LOYALTY ENHANCEMENT
// ============================================

export interface LoyaltyTier {
  id: string;
  shop_id: string;
  name: string;
  min_points: number;
  multiplier: number;
  description: string | null;
  benefits: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RewardType = 'discount' | 'product' | 'voucher' | 'free_item';

export interface LoyaltyReward {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: RewardType;
  reward_value: number | null;
  reward_item_id: string | null;
  max_redemptions_per_customer: number | null;
  total_redemptions_limit: number | null;
  current_redemptions: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyRedemption {
  id: string;
  shop_id: string;
  user_id: string;
  reward_id: string;
  order_id: string | null;
  points_redeemed: number;
  created_at: string;
}

export interface ReferralProgram {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  referrer_bonus_points: number;
  referrer_bonus_rupiah: number;
  referee_bonus_points: number;
  referee_bonus_rupiah: number;
  min_order_value_for_bonus: number | null;
  max_referrals_per_user: number | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export type ReferralStatus = 'pending' | 'converted' | 'expired';

export interface Referral {
  id: string;
  shop_id: string;
  program_id: string;
  referrer_user_id: string;
  referee_user_id: string | null;
  referral_code: string;
  status: ReferralStatus;
  converted_at: string | null;
  bonus_awarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyAnalytics {
  id: string;
  shop_id: string;
  date: string;
  total_points_earned: number;
  total_points_redeemed: number;
  total_members: number;
  active_members: number;
  new_members: number;
  total_rewards_redeemed: number;
  total_referrals: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// THIRD-PARTY INTEGRATION API
// ============================================

export interface ApiKey {
  id: string;
  shop_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiUsage {
  id: string;
  api_key_id: string;
  shop_id: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export type IntegrationProvider = 'grabfood' | 'gofood' | 'accounting_system' | 'custom';
export type IntegrationSyncStatus = 'idle' | 'syncing' | 'error';

export interface ThirdPartyIntegration {
  id: string;
  shop_id: string;
  outlet_id: string | null;
  provider: IntegrationProvider;
  provider_account_id: string | null;
  provider_account_name: string | null;
  config: Record<string, any>;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: IntegrationSyncStatus;
  sync_error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationWebhook {
  id: string;
  integration_id: string;
  shop_id: string;
  event_type: string;
  webhook_url: string;
  is_active: boolean;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

export type WebhookEventStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface WebhookEvent {
  id: string;
  webhook_id: string;
  integration_id: string;
  event_type: string;
  payload: Record<string, any>;
  status: WebhookEventStatus;
  error_message: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MappingType = 'direct' | 'transform' | 'custom_function';

export interface IntegrationMapping {
  id: string;
  integration_id: string;
  shop_id: string;
  source_field: string;
  target_field: string;
  mapping_type: MappingType;
  mapping_config: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CreateReservationRequest {
  outlet_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  special_requests?: string;
  table_id?: string;
}

export interface UpdateReservationRequest {
  status?: ReservationStatus;
  table_id?: string | null;
  special_requests?: string;
  notes?: string;
  cancelled_reason?: string;
}

export interface CreateLoyaltyRewardRequest {
  name: string;
  description?: string;
  points_required: number;
  reward_type: RewardType;
  reward_value?: number;
  reward_item_id?: string;
  max_redemptions_per_customer?: number;
  total_redemptions_limit?: number;
}

export interface CreateReferralProgramRequest {
  name: string;
  description?: string;
  referrer_bonus_points: number;
  referrer_bonus_rupiah?: number;
  referee_bonus_points: number;
  referee_bonus_rupiah?: number;
  min_order_value_for_bonus?: number;
  max_referrals_per_user?: number;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
}

export interface CreateIntegrationRequest {
  provider: IntegrationProvider;
  outlet_id?: string;
  provider_account_id?: string;
  provider_account_name?: string;
  config: Record<string, any>;
}
