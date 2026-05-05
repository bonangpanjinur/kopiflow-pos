# FlowPOS Stage 4: API Documentation

Dokumentasi lengkap untuk fitur Tahap 4 FlowPOS mencakup Sistem Reservasi, Loyalty Program Enhancement, dan Third-Party Integration API.

---

## Daftar Isi

1. [Sistem Reservasi](#sistem-reservasi)
2. [Loyalty Program Enhancement](#loyalty-program-enhancement)
3. [Third-Party Integration API](#third-party-integration-api)
4. [Authentication & Authorization](#authentication--authorization)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## Sistem Reservasi

### Overview

Sistem reservasi memungkinkan pelanggan untuk memesan meja di restoran/kafe. Fitur ini terintegrasi dengan manajemen meja dari Tahap 2 dan mendukung:

- Booking online melalui storefront
- Manajemen slot waktu otomatis
- Integrasi dengan order management
- Notifikasi reservasi

### Database Schema

#### Tabel: `reservations`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `shop_id` | UUID | FK ke coffee_shops |
| `outlet_id` | UUID | FK ke outlets |
| `table_id` | UUID | FK ke tables (nullable) |
| `customer_user_id` | UUID | FK ke auth.users (nullable) |
| `customer_name` | VARCHAR(255) | Nama pelanggan |
| `customer_phone` | VARCHAR(20) | Nomor telepon pelanggan |
| `customer_email` | VARCHAR(255) | Email pelanggan |
| `reservation_date` | DATE | Tanggal reservasi |
| `reservation_time` | TIME | Waktu reservasi |
| `party_size` | INTEGER | Jumlah orang |
| `status` | ENUM | pending, confirmed, cancelled, completed, no_show |
| `special_requests` | TEXT | Permintaan khusus |
| `notes` | TEXT | Catatan internal |
| `created_at` | TIMESTAMPTZ | Waktu pembuatan |
| `updated_at` | TIMESTAMPTZ | Waktu update terakhir |
| `cancelled_at` | TIMESTAMPTZ | Waktu pembatalan |
| `cancelled_reason` | VARCHAR(255) | Alasan pembatalan |

#### Tabel: `reservation_settings`

Konfigurasi reservasi per outlet:

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `is_enabled` | BOOLEAN | Aktifkan fitur reservasi |
| `advance_booking_days` | INTEGER | Berapa hari sebelumnya bisa booking |
| `min_party_size` | INTEGER | Ukuran grup minimum |
| `max_party_size` | INTEGER | Ukuran grup maksimum |
| `slot_duration_minutes` | INTEGER | Durasi slot (menit) |
| `slots_per_hour` | INTEGER | Jumlah slot per jam |
| `opening_time` | TIME | Jam buka |
| `closing_time` | TIME | Jam tutup |
| `allow_online_booking` | BOOLEAN | Izinkan booking online |
| `require_deposit` | BOOLEAN | Butuh deposit |
| `deposit_percent` | NUMERIC | Persentase deposit |
| `auto_confirm_booking` | BOOLEAN | Auto-confirm booking |
| `cancellation_policy_hours` | INTEGER | Jam sebelum bisa batal |

### API Endpoints

#### 1. Create Reservation

```typescript
POST /api/reservations
Content-Type: application/json

{
  "outlet_id": "uuid",
  "customer_name": "John Doe",
  "customer_phone": "+62812345678",
  "customer_email": "john@example.com",
  "reservation_date": "2026-05-15",
  "reservation_time": "19:00",
  "party_size": 4,
  "special_requests": "Near window, vegetarian options"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending",
    ...
  }
}
```

#### 2. Get Available Slots

```typescript
GET /api/reservations/slots?outlet_id=uuid&start_date=2026-05-15&end_date=2026-05-20

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2026-05-15",
      "time": "19:00",
      "available_tables": 3
    },
    ...
  ]
}
```

#### 3. Check Table Availability

```typescript
GET /api/reservations/availability?outlet_id=uuid&date=2026-05-15&time=19:00&party_size=4

Response:
{
  "success": true,
  "data": {
    "available": true,
    "available_count": 2
  }
}
```

#### 4. Update Reservation

```typescript
PATCH /api/reservations/{id}
Content-Type: application/json

{
  "status": "confirmed",
  "table_id": "uuid",
  "special_requests": "Updated request"
}

Response:
{
  "success": true,
  "data": { ... }
}
```

#### 5. Cancel Reservation

```typescript
POST /api/reservations/{id}/cancel
Content-Type: application/json

{
  "reason": "Customer requested cancellation"
}

Response:
{
  "success": true,
  "data": { ... }
}
```

#### 6. List Reservations

```typescript
GET /api/reservations?outlet_id=uuid&status=confirmed&start_date=2026-05-15&end_date=2026-05-20

Response:
{
  "success": true,
  "data": [
    { ... },
    ...
  ],
  "total": 10
}
```

---

## Loyalty Program Enhancement

### Overview

Peningkatan sistem loyalitas mencakup:

- **Loyalty Tiers**: Sistem tier berbasis poin (Bronze, Silver, Gold, Platinum)
- **Loyalty Rewards**: Hadiah yang bisa ditukar dengan poin
- **Referral Program**: Program ajak teman dengan bonus
- **Analytics**: Dashboard tracking engagement pelanggan

### Database Schema

#### Tabel: `loyalty_tiers`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `shop_id` | UUID | FK ke coffee_shops |
| `name` | VARCHAR(255) | Nama tier (Bronze, Silver, etc) |
| `min_points` | INTEGER | Poin minimum untuk tier ini |
| `multiplier` | NUMERIC(3,2) | Multiplier poin earned (1.0x, 1.5x, 2.0x) |
| `benefits` | TEXT[] | Array benefit deskripsi |
| `is_active` | BOOLEAN | Status aktif |

#### Tabel: `loyalty_rewards`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `shop_id` | UUID | FK ke coffee_shops |
| `name` | VARCHAR(255) | Nama reward |
| `points_required` | INTEGER | Poin yang dibutuhkan |
| `reward_type` | VARCHAR(50) | discount, product, voucher, free_item |
| `reward_value` | NUMERIC(10,2) | Nilai reward (rupiah atau %) |
| `reward_item_id` | UUID | FK ke menu_items (untuk product reward) |
| `max_redemptions_per_customer` | INTEGER | Limit per customer |
| `total_redemptions_limit` | INTEGER | Limit total |
| `current_redemptions` | INTEGER | Sudah ditukar berapa kali |
| `is_active` | BOOLEAN | Status aktif |
| `valid_from` | TIMESTAMPTZ | Berlaku dari |
| `valid_until` | TIMESTAMPTZ | Berlaku sampai |

#### Tabel: `referral_programs`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `shop_id` | UUID | FK ke coffee_shops |
| `name` | VARCHAR(255) | Nama program |
| `referrer_bonus_points` | INTEGER | Bonus poin untuk referrer |
| `referrer_bonus_rupiah` | NUMERIC(10,2) | Bonus rupiah untuk referrer |
| `referee_bonus_points` | INTEGER | Bonus poin untuk referee |
| `referee_bonus_rupiah` | NUMERIC(10,2) | Bonus rupiah untuk referee |
| `min_order_value_for_bonus` | NUMERIC(10,2) | Min order value untuk dapat bonus |
| `max_referrals_per_user` | INTEGER | Limit referral per user |
| `is_active` | BOOLEAN | Status aktif |

### API Endpoints

#### 1. Get Loyalty Tiers

```typescript
GET /api/loyalty/tiers?shop_id=uuid

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Silver",
      "min_points": 1000,
      "multiplier": 1.5,
      "benefits": ["Free coffee", "Priority seating"]
    },
    ...
  ]
}
```

#### 2. Get Available Rewards

```typescript
GET /api/loyalty/rewards?shop_id=uuid

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Free Coffee",
      "points_required": 500,
      "reward_type": "free_item",
      "is_active": true
    },
    ...
  ]
}
```

#### 3. Redeem Reward

```typescript
POST /api/loyalty/redeem
Content-Type: application/json

{
  "reward_id": "uuid",
  "order_id": "uuid" (optional)
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "points_redeemed": 500,
    "created_at": "2026-05-05T10:00:00Z"
  }
}
```

#### 4. Create Referral Program

```typescript
POST /api/loyalty/referral-programs
Content-Type: application/json

{
  "name": "Refer a Friend",
  "referrer_bonus_points": 100,
  "referee_bonus_points": 50,
  "min_order_value_for_bonus": 50000
}

Response:
{
  "success": true,
  "data": { ... }
}
```

#### 5. Generate Referral Code

```typescript
POST /api/loyalty/referral-codes
Content-Type: application/json

{
  "program_id": "uuid"
}

Response:
{
  "success": true,
  "data": {
    "referral_code": "ABC12345",
    "referrer_user_id": "uuid"
  }
}
```

#### 6. Redeem Referral Code

```typescript
POST /api/loyalty/redeem-referral
Content-Type: application/json

{
  "referral_code": "ABC12345"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "converted",
    "bonus_awarded_at": "2026-05-05T10:00:00Z"
  }
}
```

#### 7. Get Loyalty Analytics

```typescript
GET /api/loyalty/analytics?shop_id=uuid&start_date=2026-05-01&end_date=2026-05-31

Response:
{
  "success": true,
  "data": [
    {
      "date": "2026-05-05",
      "total_points_earned": 5000,
      "total_points_redeemed": 2000,
      "total_members": 150,
      "active_members": 45,
      "new_members": 5
    },
    ...
  ]
}
```

---

## Third-Party Integration API

### Overview

API untuk integrasi dengan layanan pihak ketiga:

- **GrabFood / GoFood**: Sinkronisasi order dari platform delivery
- **Accounting System**: Sinkronisasi transaksi ke sistem akuntansi
- **Custom Integrations**: Webhook dan API custom

### Database Schema

#### Tabel: `api_keys`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `shop_id` | UUID | FK ke coffee_shops |
| `name` | VARCHAR(255) | Nama API key |
| `key_prefix` | VARCHAR(10) | Prefix untuk display (sk_...) |
| `key_hash` | VARCHAR(255) | Hash dari key (disimpan, bukan plaintext) |
| `scopes` | TEXT[] | Array scope (orders.read, orders.write, etc) |
| `rate_limit_per_minute` | INTEGER | Rate limit per menit |
| `rate_limit_per_day` | INTEGER | Rate limit per hari |
| `is_active` | BOOLEAN | Status aktif |
| `last_used_at` | TIMESTAMPTZ | Terakhir digunakan |

#### Tabel: `third_party_integrations`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `shop_id` | UUID | FK ke coffee_shops |
| `outlet_id` | UUID | FK ke outlets (nullable) |
| `provider` | VARCHAR(50) | grabfood, gofood, accounting_system, custom |
| `provider_account_id` | VARCHAR(255) | ID akun di provider |
| `provider_account_name` | VARCHAR(255) | Nama akun di provider |
| `config` | JSONB | Konfigurasi JSON (API key, webhook secret, dll) |
| `is_active` | BOOLEAN | Status aktif |
| `last_sync_at` | TIMESTAMPTZ | Terakhir sync |
| `sync_status` | VARCHAR(50) | idle, syncing, error |
| `sync_error_message` | TEXT | Pesan error jika ada |

#### Tabel: `integration_webhooks`

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `integration_id` | UUID | FK ke third_party_integrations |
| `event_type` | VARCHAR(100) | order.created, order.updated, etc |
| `webhook_url` | VARCHAR(500) | URL untuk menerima webhook |
| `is_active` | BOOLEAN | Status aktif |
| `max_retries` | INTEGER | Maksimal retry |

### API Endpoints

#### 1. Create API Key

```typescript
POST /api/integrations/api-keys
Content-Type: application/json

{
  "name": "GrabFood Integration",
  "scopes": ["orders.read", "orders.write"],
  "rate_limit_per_minute": 60,
  "rate_limit_per_day": 10000
}

Response:
{
  "success": true,
  "data": {
    "key": "sk_live_abc123def456...", // Hanya ditampilkan sekali!
    "apiKey": {
      "id": "uuid",
      "name": "GrabFood Integration",
      "key_prefix": "sk_live_abc",
      "scopes": ["orders.read", "orders.write"],
      "is_active": true
    }
  }
}
```

#### 2. List API Keys

```typescript
GET /api/integrations/api-keys

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "GrabFood Integration",
      "key_prefix": "sk_live_abc",
      "scopes": ["orders.read", "orders.write"],
      "rate_limit_per_minute": 60,
      "rate_limit_per_day": 10000,
      "is_active": true,
      "last_used_at": "2026-05-05T10:00:00Z"
    },
    ...
  ]
}
```

#### 3. Revoke API Key

```typescript
DELETE /api/integrations/api-keys/{id}

Response:
{
  "success": true,
  "message": "API key revoked"
}
```

#### 4. Create Integration

```typescript
POST /api/integrations
Content-Type: application/json

{
  "provider": "grabfood",
  "outlet_id": "uuid",
  "provider_account_id": "grabfood_merchant_123",
  "provider_account_name": "My Restaurant",
  "config": {
    "api_key": "grabfood_api_key",
    "webhook_secret": "webhook_secret_123"
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "provider": "grabfood",
    "is_active": false,
    "sync_status": "idle"
  }
}
```

#### 5. List Integrations

```typescript
GET /api/integrations

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "provider": "grabfood",
      "provider_account_name": "My Restaurant",
      "is_active": true,
      "last_sync_at": "2026-05-05T10:00:00Z",
      "sync_status": "idle"
    },
    ...
  ]
}
```

#### 6. Enable/Disable Integration

```typescript
PATCH /api/integrations/{id}
Content-Type: application/json

{
  "is_active": true
}

Response:
{
  "success": true,
  "data": { ... }
}
```

#### 7. Create Webhook

```typescript
POST /api/integrations/{id}/webhooks
Content-Type: application/json

{
  "event_type": "order.created",
  "webhook_url": "https://your-app.com/webhooks/grabfood"
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "event_type": "order.created",
    "webhook_url": "https://your-app.com/webhooks/grabfood",
    "is_active": true
  }
}
```

#### 8. List Webhooks

```typescript
GET /api/integrations/{id}/webhooks

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "event_type": "order.created",
      "webhook_url": "https://your-app.com/webhooks/grabfood",
      "is_active": true,
      "retry_count": 0
    },
    ...
  ]
}
```

#### 9. Get API Usage Statistics

```typescript
GET /api/integrations/api-keys/{id}/usage?hours=24

Response:
{
  "success": true,
  "data": {
    "totalRequests": 1250,
    "successfulRequests": 1240,
    "failedRequests": 10,
    "averageResponseTime": 145
  }
}
```

---

## Authentication & Authorization

### API Key Authentication

Semua request ke Third-Party Integration API harus menyertakan API key:

```bash
curl -H "Authorization: Bearer sk_live_abc123def456..." \
  https://api.flowpos.local/api/integrations/...
```

### Scopes

Scopes yang tersedia:

- `orders.read` - Baca data order
- `orders.write` - Buat/update order
- `reservations.read` - Baca data reservasi
- `reservations.write` - Buat/update reservasi
- `loyalty.read` - Baca data loyalitas
- `loyalty.write` - Update loyalitas
- `integrations.read` - Baca konfigurasi integrasi
- `integrations.write` - Update konfigurasi integrasi
- `admin` - Full access

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "INVALID_REQUEST",
  "message": "Customer name is required"
}
```

### Common Error Codes

| Code | Status | Deskripsi |
|------|--------|-----------|
| `INVALID_REQUEST` | 400 | Request tidak valid |
| `UNAUTHORIZED` | 401 | API key tidak valid atau expired |
| `FORBIDDEN` | 403 | Tidak punya akses ke resource |
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `CONFLICT` | 409 | Conflict (e.g., duplicate entry) |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit terlampaui |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

### Headers

Response akan menyertakan rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1620000000
```

### Behavior

- Ketika limit tercapai, API mengembalikan status `429 Too Many Requests`
- Client harus menunggu sampai window berikutnya sebelum retry
- Reset time ditunjukkan di header `X-RateLimit-Reset` (Unix timestamp)

---

## Webhook Payload Examples

### Order Created Event

```json
{
  "event_type": "order.created",
  "timestamp": "2026-05-05T10:00:00Z",
  "data": {
    "order_id": "uuid",
    "shop_id": "uuid",
    "outlet_id": "uuid",
    "customer_name": "John Doe",
    "total": 150000,
    "items": [
      {
        "menu_item_id": "uuid",
        "name": "Espresso",
        "quantity": 2,
        "price": 50000
      }
    ],
    "status": "pending"
  }
}
```

### Reservation Created Event

```json
{
  "event_type": "reservation.created",
  "timestamp": "2026-05-05T10:00:00Z",
  "data": {
    "reservation_id": "uuid",
    "shop_id": "uuid",
    "outlet_id": "uuid",
    "customer_name": "Jane Doe",
    "reservation_date": "2026-05-15",
    "reservation_time": "19:00",
    "party_size": 4,
    "status": "pending"
  }
}
```

---

## Best Practices

1. **Secure API Keys**: Jangan hardcode API keys di client-side code
2. **Webhook Verification**: Verifikasi signature webhook sebelum memproses
3. **Idempotency**: Gunakan idempotency key untuk mencegah duplicate requests
4. **Retry Logic**: Implement exponential backoff untuk retry
5. **Logging**: Log semua API calls untuk debugging dan audit
6. **Monitoring**: Monitor rate limit dan error rates
7. **Versioning**: Selalu gunakan API version terbaru

---

## Support & Documentation

- **API Reference**: https://api.flowpos.local/docs
- **Webhook Events**: https://docs.flowpos.local/webhooks
- **Integration Guides**: https://docs.flowpos.local/integrations
- **Support Email**: support@flowpos.local
