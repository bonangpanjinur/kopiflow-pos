import { supabase } from "@/integrations/supabase/client";
import type {
  ApiKey,
  ApiUsage,
  ThirdPartyIntegration,
  IntegrationWebhook,
  WebhookEvent,
  IntegrationMapping,
  CreateApiKeyRequest,
  CreateIntegrationRequest,
} from "@/types/stage4";

/**
 * Create a new API key for a shop
 */
export async function createApiKey(
  shopId: string,
  request: CreateApiKeyRequest
): Promise<{ key: string; apiKey: ApiKey } | null> {
  // Generate a random key
  const key = `sk_${generateRandomString(32)}`;
  const keyPrefix = key.substring(0, 10);
  const keyHash = await hashString(key);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      shop_id: shopId,
      name: request.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: request.scopes,
      rate_limit_per_minute: request.rate_limit_per_minute || 60,
      rate_limit_per_day: request.rate_limit_per_day || 10000,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating API key:", error);
    return null;
  }

  return {
    key,
    apiKey: data as ApiKey,
  };
}

/**
 * Get API keys for a shop
 */
export async function getApiKeys(shopId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching API keys:", error);
    return [];
  }

  return (data || []) as ApiKey[];
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(apiKeyId: string): Promise<boolean> {
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", apiKeyId);

  if (error) {
    console.error("Error revoking API key:", error);
    return false;
  }

  return true;
}

/**
 * Record API usage
 */
export async function recordApiUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  errorMessage?: string
): Promise<boolean> {
  const { error } = await supabase.rpc("record_api_usage", {
    _api_key_id: apiKeyId,
    _endpoint: endpoint,
    _method: method,
    _status_code: statusCode,
    _response_time_ms: responseTimeMs,
    _error_message: errorMessage || null,
  });

  if (error) {
    console.error("Error recording API usage:", error);
    return false;
  }

  return true;
}

/**
 * Check API rate limit
 */
export async function checkApiRateLimit(
  apiKeyId: string
): Promise<{ allowed: boolean; minuteCount: number; dayCount: number } | null> {
  const { data, error } = await supabase.rpc("check_api_rate_limit", {
    _api_key_id: apiKeyId,
  });

  if (error) {
    console.error("Error checking API rate limit:", error);
    return null;
  }

  const result = (data?.[0] || {}) as {
    allowed: boolean;
    current_minute_count: number;
    current_day_count: number;
  };

  return {
    allowed: result.allowed,
    minuteCount: result.current_minute_count,
    dayCount: result.current_day_count,
  };
}

/**
 * Create third-party integration
 */
export async function createIntegration(
  shopId: string,
  request: CreateIntegrationRequest
): Promise<ThirdPartyIntegration | null> {
  const { data, error } = await supabase
    .from("third_party_integrations")
    .insert({
      shop_id: shopId,
      outlet_id: request.outlet_id || null,
      provider: request.provider,
      provider_account_id: request.provider_account_id || null,
      provider_account_name: request.provider_account_name || null,
      config: request.config,
      is_active: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating integration:", error);
    return null;
  }

  return data as ThirdPartyIntegration;
}

/**
 * Get integrations for a shop
 */
export async function getIntegrations(shopId: string): Promise<ThirdPartyIntegration[]> {
  const { data, error } = await supabase
    .from("third_party_integrations")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching integrations:", error);
    return [];
  }

  return (data || []) as ThirdPartyIntegration[];
}

/**
 * Update integration configuration
 */
export async function updateIntegration(
  integrationId: string,
  updates: Partial<ThirdPartyIntegration>
): Promise<ThirdPartyIntegration | null> {
  const { data, error } = await supabase
    .from("third_party_integrations")
    .update(updates)
    .eq("id", integrationId)
    .select()
    .single();

  if (error) {
    console.error("Error updating integration:", error);
    return null;
  }

  return data as ThirdPartyIntegration;
}

/**
 * Enable/disable integration
 */
export async function toggleIntegration(
  integrationId: string,
  isActive: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("third_party_integrations")
    .update({ is_active: isActive })
    .eq("id", integrationId);

  if (error) {
    console.error("Error toggling integration:", error);
    return false;
  }

  return true;
}

/**
 * Create webhook for integration
 */
export async function createWebhook(
  integrationId: string,
  shopId: string,
  eventType: string,
  webhookUrl: string
): Promise<IntegrationWebhook | null> {
  const { data, error } = await supabase
    .from("integration_webhooks")
    .insert({
      integration_id: integrationId,
      shop_id: shopId,
      event_type: eventType,
      webhook_url: webhookUrl,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating webhook:", error);
    return null;
  }

  return data as IntegrationWebhook;
}

/**
 * Get webhooks for integration
 */
export async function getWebhooks(integrationId: string): Promise<IntegrationWebhook[]> {
  const { data, error } = await supabase
    .from("integration_webhooks")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at");

  if (error) {
    console.error("Error fetching webhooks:", error);
    return [];
  }

  return (data || []) as IntegrationWebhook[];
}

/**
 * Trigger webhook event
 */
export async function triggerWebhookEvent(
  webhookId: string,
  integrationId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<WebhookEvent | null> {
  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      webhook_id: webhookId,
      integration_id: integrationId,
      event_type: eventType,
      payload,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error triggering webhook event:", error);
    return null;
  }

  return data as WebhookEvent;
}

/**
 * Get webhook events
 */
export async function getWebhookEvents(
  webhookId: string,
  limit: number = 50
): Promise<WebhookEvent[]> {
  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching webhook events:", error);
    return [];
  }

  return (data || []) as WebhookEvent[];
}

/**
 * Create field mapping for integration
 */
export async function createFieldMapping(
  integrationId: string,
  shopId: string,
  sourceField: string,
  targetField: string,
  mappingType: string = "direct",
  mappingConfig?: Record<string, any>
): Promise<IntegrationMapping | null> {
  const { data, error } = await supabase
    .from("integration_mappings")
    .insert({
      integration_id: integrationId,
      shop_id: shopId,
      source_field: sourceField,
      target_field: targetField,
      mapping_type: mappingType,
      mapping_config: mappingConfig || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating field mapping:", error);
    return null;
  }

  return data as IntegrationMapping;
}

/**
 * Get field mappings for integration
 */
export async function getFieldMappings(integrationId: string): Promise<IntegrationMapping[]> {
  const { data, error } = await supabase
    .from("integration_mappings")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at");

  if (error) {
    console.error("Error fetching field mappings:", error);
    return [];
  }

  return (data || []) as IntegrationMapping[];
}

/**
 * Get API usage statistics
 */
export async function getApiUsageStats(
  apiKeyId: string,
  hours: number = 24
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
}> {
  const { data, error } = await supabase
    .from("api_usage")
    .select("*")
    .eq("api_key_id", apiKeyId)
    .gte("created_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("Error fetching API usage stats:", error);
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
    };
  }

  const usage = (data || []) as ApiUsage[];
  const successfulRequests = usage.filter((u) => u.status_code && u.status_code < 400).length;
  const failedRequests = usage.filter((u) => u.status_code && u.status_code >= 400).length;
  const avgResponseTime =
    usage.length > 0
      ? usage.reduce((sum, u) => sum + (u.response_time_ms || 0), 0) / usage.length
      : 0;

  return {
    totalRequests: usage.length,
    successfulRequests,
    failedRequests,
    averageResponseTime: Math.round(avgResponseTime),
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
