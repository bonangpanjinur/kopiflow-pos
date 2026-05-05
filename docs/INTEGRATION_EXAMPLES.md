# FlowPOS Stage 4: Integration Examples

Contoh implementasi integrasi dengan layanan pihak ketiga seperti GrabFood, GoFood, dan sistem akuntansi.

---

## Table of Contents

1. [GrabFood Integration](#grabfood-integration)
2. [GoFood Integration](#gofood-integration)
3. [Accounting System Integration](#accounting-system-integration)
4. [Webhook Implementation](#webhook-implementation)
5. [Error Handling & Retry Logic](#error-handling--retry-logic)

---

## GrabFood Integration

### Setup

1. **Create Integration**

```typescript
// Create GrabFood integration
const integration = await createIntegration(shopId, {
  provider: 'grabfood',
  outlet_id: outletId,
  provider_account_id: 'grabfood_merchant_12345',
  provider_account_name: 'My Restaurant',
  config: {
    api_key: 'grabfood_api_key_xxx',
    webhook_secret: 'webhook_secret_yyy',
    merchant_id: 'merchant_12345',
    store_id: 'store_12345'
  }
});
```

2. **Create Webhooks**

```typescript
// Subscribe to GrabFood events
await createWebhook(
  integration.id,
  shopId,
  'order.created',
  'https://your-app.com/webhooks/grabfood/order-created'
);

await createWebhook(
  integration.id,
  shopId,
  'order.updated',
  'https://your-app.com/webhooks/grabfood/order-updated'
);

await createWebhook(
  integration.id,
  shopId,
  'order.cancelled',
  'https://your-app.com/webhooks/grabfood/order-cancelled'
);
```

### Webhook Handler

```typescript
// supabase/functions/webhooks/grabfood.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { event_type, data } = body;

    // Verify webhook signature
    const signature = req.headers.get("X-Grabfood-Signature");
    if (!verifySignature(body, signature)) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Get integration
    const { data: integration } = await supabase
      .from("third_party_integrations")
      .select("*")
      .eq("provider", "grabfood")
      .eq("provider_account_id", data.merchant_id)
      .single();

    if (!integration) {
      return new Response("Integration not found", { status: 404 });
    }

    // Handle different event types
    switch (event_type) {
      case "order.created":
        await handleOrderCreated(integration, data);
        break;
      case "order.updated":
        await handleOrderUpdated(integration, data);
        break;
      case "order.cancelled":
        await handleOrderCancelled(integration, data);
        break;
    }

    // Record webhook event
    await supabase.from("webhook_events").insert({
      webhook_id: integration.id,
      integration_id: integration.id,
      event_type,
      payload: body,
      status: "delivered",
      delivered_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function handleOrderCreated(integration: any, data: any) {
  // Map GrabFood order to FlowPOS order
  const order = {
    shop_id: integration.shop_id,
    outlet_id: integration.outlet_id,
    external_order_id: data.order_id,
    external_provider: "grabfood",
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    total: data.total_amount,
    status: "pending",
    channel: "online",
    items: data.items.map((item: any) => ({
      menu_item_id: mapExternalItemId(item.id),
      quantity: item.quantity,
      price: item.price,
      notes: item.special_instructions,
    })),
    delivery_address: data.delivery_address,
    notes: data.special_requests,
  };

  // Create order in FlowPOS
  const { data: createdOrder } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();

  // Update GrabFood order status
  await updateGrabFoodOrderStatus(
    integration.config.api_key,
    data.order_id,
    "accepted"
  );
}

async function handleOrderUpdated(integration: any, data: any) {
  // Update order status
  if (data.status === "completed") {
    await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("external_order_id", data.order_id);
  } else if (data.status === "cancelled") {
    await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("external_order_id", data.order_id);
  }
}

async function handleOrderCancelled(integration: any, data: any) {
  await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("external_order_id", data.order_id);
}

function verifySignature(body: any, signature: string): boolean {
  // Implement signature verification
  // Using HMAC-SHA256 with webhook secret
  const crypto = require("crypto");
  const secret = Deno.env.get("GRABFOOD_WEBHOOK_SECRET");
  const hash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");
  return hash === signature;
}

async function updateGrabFoodOrderStatus(
  apiKey: string,
  orderId: string,
  status: string
) {
  const response = await fetch(
    `https://api.grab.com/grabfood/v1/orders/${orderId}/status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update GrabFood order: ${response.statusText}`);
  }

  return response.json();
}

function mapExternalItemId(externalId: string): string {
  // Map external item ID to FlowPOS menu_item_id
  // This should be stored in integration_mappings table
  // For now, return placeholder
  return externalId;
}
```

### Order Sync

```typescript
// Sync orders from GrabFood periodically

export async function syncGrabFoodOrders(integrationId: string) {
  const { data: integration } = await supabase
    .from("third_party_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (!integration || !integration.is_active) {
    return;
  }

  try {
    // Update sync status
    await supabase
      .from("third_party_integrations")
      .update({ sync_status: "syncing" })
      .eq("id", integrationId);

    // Fetch orders from GrabFood API
    const orders = await fetchGrabFoodOrders(
      integration.config.api_key,
      integration.config.merchant_id
    );

    // Process each order
    for (const order of orders) {
      await processGrabFoodOrder(integration, order);
    }

    // Update sync status
    await supabase
      .from("third_party_integrations")
      .update({
        sync_status: "idle",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", integrationId);
  } catch (error) {
    console.error("Error syncing GrabFood orders:", error);
    await supabase
      .from("third_party_integrations")
      .update({
        sync_status: "error",
        sync_error_message: error.message,
      })
      .eq("id", integrationId);
  }
}
```

---

## GoFood Integration

### Setup

Similar to GrabFood, but with GoFood-specific configuration:

```typescript
const integration = await createIntegration(shopId, {
  provider: 'gofood',
  outlet_id: outletId,
  provider_account_id: 'gofood_merchant_67890',
  provider_account_name: 'My Restaurant',
  config: {
    api_key: 'gofood_api_key_xxx',
    webhook_secret: 'webhook_secret_yyy',
    merchant_id: 'merchant_67890',
    branch_id: 'branch_67890'
  }
});
```

### Webhook Handler

```typescript
// supabase/functions/webhooks/gofood.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { event_type, data } = body;

    // Verify webhook signature (GoFood uses different format)
    const signature = req.headers.get("X-Gofood-Signature");
    if (!verifyGoFoodSignature(body, signature)) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Similar processing as GrabFood
    // Handle order.created, order.updated, order.cancelled events

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing GoFood webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

## Accounting System Integration

### Setup

```typescript
const integration = await createIntegration(shopId, {
  provider: 'accounting_system',
  outlet_id: outletId,
  provider_account_id: 'accounting_account_123',
  provider_account_name: 'My Accounting System',
  config: {
    api_key: 'accounting_api_key_xxx',
    api_url: 'https://api.accounting-system.com',
    company_id: 'company_123',
    sync_frequency: 'daily' // daily, weekly, monthly
  }
});
```

### Transaction Sync

```typescript
// supabase/functions/sync-accounting.ts

export async function syncTransactionsToAccounting(integrationId: string) {
  const { data: integration } = await supabase
    .from("third_party_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (!integration || !integration.is_active) {
    return;
  }

  try {
    // Get transactions since last sync
    const lastSync = integration.last_sync_at
      ? new Date(integration.last_sync_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("shop_id", integration.shop_id)
      .gte("created_at", lastSync.toISOString())
      .eq("status", "completed");

    // Transform orders to accounting transactions
    const transactions = orders.map((order) => ({
      transaction_id: order.id,
      date: order.created_at,
      description: `Order #${order.id}`,
      amount: order.total,
      currency: "IDR",
      account: "Sales",
      reference: order.external_order_id || order.id,
      metadata: {
        customer: order.customer_name,
        items: order.items,
      },
    }));

    // Send to accounting system
    for (const transaction of transactions) {
      await sendTransactionToAccounting(
        integration.config.api_key,
        integration.config.api_url,
        transaction
      );
    }

    // Update sync status
    await supabase
      .from("third_party_integrations")
      .update({
        sync_status: "idle",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", integrationId);
  } catch (error) {
    console.error("Error syncing to accounting system:", error);
    await supabase
      .from("third_party_integrations")
      .update({
        sync_status: "error",
        sync_error_message: error.message,
      })
      .eq("id", integrationId);
  }
}

async function sendTransactionToAccounting(
  apiKey: string,
  apiUrl: string,
  transaction: any
) {
  const response = await fetch(`${apiUrl}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(transaction),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to send transaction: ${response.statusText}`
    );
  }

  return response.json();
}
```

---

## Webhook Implementation

### Webhook Receiver Endpoint

```typescript
// artifacts/kopihub/src/server/webhooks.functions.ts

import { supabase } from "@/integrations/supabase/client";

export async function handleWebhook(req: Request) {
  const { integrationId, eventType, payload } = await req.json();

  // Validate webhook
  const { data: webhook } = await supabase
    .from("integration_webhooks")
    .select("*")
    .eq("event_type", eventType)
    .eq("is_active", true)
    .single();

  if (!webhook) {
    return { success: false, error: "Webhook not found" };
  }

  // Create webhook event record
  const { data: event } = await supabase
    .from("webhook_events")
    .insert({
      webhook_id: webhook.id,
      integration_id: integrationId,
      event_type: eventType,
      payload,
      status: "pending",
    })
    .select()
    .single();

  // Send webhook to external URL
  await sendWebhookEvent(webhook.webhook_url, event);

  return { success: true, event_id: event.id };
}

async function sendWebhookEvent(webhookUrl: string, event: any) {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FlowPOS-Event-ID": event.id,
          "X-FlowPOS-Event-Type": event.event_type,
          "X-FlowPOS-Timestamp": new Date().toISOString(),
        },
        body: JSON.stringify(event.payload),
      });

      if (response.ok) {
        // Update event status
        await supabase
          .from("webhook_events")
          .update({
            status: "delivered",
            delivered_at: new Date().toISOString(),
          })
          .eq("id", event.id);
        return;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error, don't retry
        throw new Error(`Client error: ${response.statusText}`);
      }
    } catch (error) {
      attempt++;
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Final attempt failed
        await supabase
          .from("webhook_events")
          .update({
            status: "failed",
            error_message: error.message,
            attempt_count: attempt,
            next_retry_at: null,
          })
          .eq("id", event.id);
      }
    }
  }
}
```

---

## Error Handling & Retry Logic

### Retry Strategy

```typescript
// Exponential backoff with jitter
function calculateRetryDelay(attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 1 minute
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attempt),
    maxDelay
  );
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return exponentialDelay + jitter;
}

// Retry webhook events
export async function retryFailedWebhooks() {
  const { data: failedEvents } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("status", "failed")
    .lt("attempt_count", 5)
    .lt("next_retry_at", new Date().toISOString());

  for (const event of failedEvents || []) {
    const { data: webhook } = await supabase
      .from("integration_webhooks")
      .select("*")
      .eq("id", event.webhook_id)
      .single();

    if (webhook) {
      await sendWebhookEvent(webhook.webhook_url, event);
    }
  }
}
```

### Error Logging

```typescript
// Log all API errors
export async function logApiError(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  errorMessage: string
) {
  await supabase.from("api_usage").insert({
    api_key_id: apiKeyId,
    endpoint,
    method,
    status_code: statusCode,
    error_message: errorMessage,
  });

  // Alert if error rate is high
  const { data: recentErrors } = await supabase
    .from("api_usage")
    .select("*")
    .eq("api_key_id", apiKeyId)
    .gte("status_code", 400)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if ((recentErrors || []).length > 10) {
    // Send alert
    console.warn(`High error rate for API key: ${apiKeyId}`);
  }
}
```

---

## Testing Integrations

### Mock Webhook Events

```typescript
// Test GrabFood webhook
const mockGrabFoodOrder = {
  event_type: "order.created",
  data: {
    order_id: "grabfood_order_123",
    merchant_id: "merchant_12345",
    customer_name: "John Doe",
    customer_phone: "+62812345678",
    total_amount: 150000,
    items: [
      {
        id: "item_123",
        name: "Espresso",
        quantity: 2,
        price: 50000,
      },
    ],
    delivery_address: "Jl. Sudirman No. 1, Jakarta",
    special_requests: "Extra hot",
  },
};

// Test webhook handler
await handleWebhook(mockGrabFoodOrder);
```

### Integration Tests

```typescript
// tests/integrations/grabfood.test.ts
describe("GrabFood Integration", () => {
  test("should create order from webhook", async () => {
    const response = await handleWebhook(mockGrabFoodOrder);
    expect(response.success).toBe(true);

    // Verify order created in database
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("external_order_id", "grabfood_order_123")
      .single();

    expect(order).toBeDefined();
    expect(order.customer_name).toBe("John Doe");
  });

  test("should update order status", async () => {
    const updateEvent = {
      event_type: "order.updated",
      data: {
        order_id: "grabfood_order_123",
        status: "completed",
      },
    };

    await handleWebhook(updateEvent);

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("external_order_id", "grabfood_order_123")
      .single();

    expect(order.status).toBe("completed");
  });
});
```

---

## Monitoring & Debugging

### Integration Status Dashboard

```typescript
// Get integration health status
export async function getIntegrationHealth(integrationId: string) {
  const { data: integration } = await supabase
    .from("third_party_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  const { data: recentEvents } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("integration_id", integrationId)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const successCount = (recentEvents || []).filter(
    (e) => e.status === "delivered"
  ).length;
  const failureCount = (recentEvents || []).filter(
    (e) => e.status === "failed"
  ).length;

  return {
    is_active: integration.is_active,
    last_sync: integration.last_sync_at,
    sync_status: integration.sync_status,
    success_rate: (successCount / (successCount + failureCount)) * 100,
    recent_errors: failureCount,
  };
}
```

---

## References

- [GrabFood API Documentation](https://developer.grab.com/grabfood)
- [GoFood API Documentation](https://developer.gojek.com/gofood)
- [Webhook Best Practices](https://www.svix.com/blog/webhook-best-practices/)
- [API Security](https://owasp.org/www-project-api-security/)
