# FlowPOS Stage 4: Implementation Guide

Panduan lengkap untuk mengimplementasikan fitur Tahap 4 pada FlowPOS.

---

## Table of Contents

1. [Overview](#overview)
2. [Database Migration](#database-migration)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Testing Strategy](#testing-strategy)
6. [Deployment Checklist](#deployment-checklist)

---

## Overview

### Stage 4 Components

Tahap 4 terdiri dari tiga komponen utama:

#### 1. Sistem Reservasi (Reservation System)

**Tujuan**: Memungkinkan pelanggan memesan meja secara online

**Fitur Utama**:
- Booking online dengan slot time
- Manajemen ketersediaan meja otomatis
- Integrasi dengan table management (Tahap 2)
- Notifikasi reservasi ke customer
- Cancellation policy

**Database Tables**:
- `reservations` - Data reservasi
- `reservation_slots` - Slot waktu yang tersedia
- `reservation_settings` - Konfigurasi per outlet

**Key Functions**:
- `check_table_availability()` - Cek ketersediaan meja
- `generate_reservation_slots()` - Generate slot otomatis

#### 2. Loyalty Program Enhancement (Peningkatan Program Loyalitas)

**Tujuan**: Meningkatkan retensi pelanggan melalui sistem poin dan reward

**Fitur Utama**:
- Loyalty tiers dengan multiplier poin
- Reward catalog dengan berbagai tipe
- Referral program untuk akuisisi
- Analytics dashboard
- Tier-based benefits

**Database Tables**:
- `loyalty_tiers` - Tier membership (Bronze, Silver, Gold, Platinum)
- `loyalty_rewards` - Catalog reward
- `loyalty_redemptions` - History penukar reward
- `referral_programs` - Program referral
- `referrals` - Data referral individual
- `loyalty_analytics` - Analytics harian

**Key Functions**:
- `award_referral_bonus()` - Award bonus referral
- `generate_referral_code()` - Generate unique code

#### 3. Third-Party Integration API (API Integrasi Pihak Ketiga)

**Tujuan**: Membuka akses untuk integrasi dengan layanan eksternal

**Fitur Utama**:
- API key management dengan rate limiting
- Webhook support untuk event-driven integration
- Field mapping untuk data transformation
- Integration monitoring dan logging
- Support untuk GrabFood, GoFood, Accounting System

**Database Tables**:
- `api_keys` - API key management
- `api_usage` - Tracking penggunaan API
- `third_party_integrations` - Konfigurasi integrasi
- `integration_webhooks` - Webhook configuration
- `webhook_events` - History webhook events
- `integration_mappings` - Field mapping rules

**Key Functions**:
- `record_api_usage()` - Catat penggunaan API
- `check_api_rate_limit()` - Validasi rate limit

---

## Database Migration

### Step 1: Apply Migrations

```bash
# Navigate to project root
cd /home/ubuntu/kopiflow-pos

# Apply Stage 4 migrations
supabase migration up --db-url postgresql://...

# Atau gunakan Supabase CLI
supabase db push
```

### Migrations Files

Tiga file migration utama telah dibuat:

1. **`20260505_stage4_reservations.sql`**
   - Tabel: `reservations`, `reservation_slots`, `reservation_settings`
   - Functions: `check_table_availability()`, `generate_reservation_slots()`
   - RLS Policies untuk keamanan data

2. **`20260505_stage4_loyalty_enhancement.sql`**
   - Tabel: `loyalty_tiers`, `loyalty_rewards`, `loyalty_redemptions`, `referral_programs`, `referrals`, `loyalty_analytics`
   - Functions: `generate_referral_code()`, `award_referral_bonus()`
   - RLS Policies

3. **`20260505_stage4_third_party_api.sql`**
   - Tabel: `api_keys`, `api_usage`, `third_party_integrations`, `integration_webhooks`, `webhook_events`, `integration_mappings`
   - Functions: `record_api_usage()`, `check_api_rate_limit()`
   - RLS Policies

### Step 2: Verify Migrations

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('reservations', 'loyalty_tiers', 'api_keys');

-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('check_table_availability', 'award_referral_bonus', 'record_api_usage');
```

---

## Backend Implementation

### 1. Supabase Functions (Edge Functions)

Create Supabase Edge Functions untuk business logic yang kompleks:

```bash
# Create functions directory
mkdir -p supabase/functions

# Create reservation functions
supabase functions new create-reservation
supabase functions new check-availability
supabase functions new generate-slots

# Create loyalty functions
supabase functions new redeem-reward
supabase functions new award-referral-bonus

# Create API functions
supabase functions new validate-api-key
supabase functions new record-api-usage
supabase functions new trigger-webhook
```

### 2. TypeScript Utility Functions

Utility functions sudah dibuat di:

- **`src/lib/reservations.ts`** - Fungsi reservasi
- **`src/lib/loyalty-enhanced.ts`** - Fungsi loyalty
- **`src/lib/third-party-api.ts`** - Fungsi API integrasi

### 3. Type Definitions

Type definitions tersedia di:

- **`src/types/stage4.ts`** - Semua type definitions

### 4. Server Functions

Implementasi server functions untuk operasi yang memerlukan authentication:

```typescript
// Example: artifacts/kopihub/src/server/reservations.functions.ts

import { supabase } from "@/integrations/supabase/client";
import type { Reservation } from "@/types/stage4";

export async function createReservation(
  shopId: string,
  request: CreateReservationRequest
): Promise<Reservation | null> {
  // Validate input
  // Check availability
  // Create reservation
  // Send notification
  // Return result
}
```

---

## Frontend Implementation

### 1. Reservation Pages

Create pages untuk reservation management:

```bash
# Create reservation routes
mkdir -p artifacts/kopihub/src/routes/app.reservations
touch artifacts/kopihub/src/routes/app.reservations.tsx
touch artifacts/kopihub/src/routes/app.reservations.settings.tsx
```

**`app.reservations.tsx`** - List dan manage reservations
**`app.reservations.settings.tsx`** - Configure reservation settings

### 2. Loyalty Pages

Create pages untuk loyalty management:

```bash
# Create loyalty routes
mkdir -p artifacts/kopihub/src/routes/app.loyalty-enhanced
touch artifacts/kopihub/src/routes/app.loyalty-enhanced.tiers.tsx
touch artifacts/kopihub/src/routes/app.loyalty-enhanced.rewards.tsx
touch artifacts/kopihub/src/routes/app.loyalty-enhanced.referrals.tsx
touch artifacts/kopihub/src/routes/app.loyalty-enhanced.analytics.tsx
```

### 3. Integration Pages

Create pages untuk third-party integration:

```bash
# Create integration routes
mkdir -p artifacts/kopihub/src/routes/app.integrations
touch artifacts/kopihub/src/routes/app.integrations.tsx
touch artifacts/kopihub/src/routes/app.integrations.api-keys.tsx
touch artifacts/kopihub/src/routes/app.integrations.webhooks.tsx
```

### 4. Components

Create reusable components:

```bash
# Create components
mkdir -p artifacts/kopihub/src/components/reservations
mkdir -p artifacts/kopihub/src/components/loyalty
mkdir -p artifacts/kopihub/src/components/integrations

# Reservation components
touch artifacts/kopihub/src/components/reservations/ReservationForm.tsx
touch artifacts/kopihub/src/components/reservations/ReservationList.tsx
touch artifacts/kopihub/src/components/reservations/ReservationCalendar.tsx

# Loyalty components
touch artifacts/kopihub/src/components/loyalty/LoyaltyTierCard.tsx
touch artifacts/kopihub/src/components/loyalty/RewardCard.tsx
touch artifacts/kopihub/src/components/loyalty/ReferralWidget.tsx

# Integration components
touch artifacts/kopihub/src/components/integrations/ApiKeyForm.tsx
touch artifacts/kopihub/src/components/integrations/IntegrationCard.tsx
touch artifacts/kopihub/src/components/integrations/WebhookForm.tsx
```

### 5. Hooks

Create custom hooks:

```typescript
// artifacts/kopihub/src/hooks/use-reservations.ts
export function useReservations(outletId: string) {
  // Fetch reservations
  // Handle loading/error states
  // Provide CRUD operations
}

// artifacts/kopihub/src/hooks/use-loyalty.ts
export function useLoyalty(shopId: string) {
  // Fetch loyalty data
  // Handle tier calculations
  // Provide reward operations
}

// artifacts/kopihub/src/hooks/use-integrations.ts
export function useIntegrations(shopId: string) {
  // Fetch integrations
  // Handle API key management
  // Provide webhook operations
}
```

---

## Testing Strategy

### 1. Unit Tests

Test utility functions:

```typescript
// tests/lib/reservations.test.ts
describe('Reservations', () => {
  test('should check table availability', async () => {
    // Test availability check
  });

  test('should create reservation', async () => {
    // Test reservation creation
  });

  test('should cancel reservation', async () => {
    // Test cancellation
  });
});
```

### 2. Integration Tests

Test database operations:

```typescript
// tests/integration/reservations.test.ts
describe('Reservations Integration', () => {
  test('should create and retrieve reservation', async () => {
    // Create reservation
    // Retrieve from database
    // Verify data
  });
});
```

### 3. API Tests

Test API endpoints:

```bash
# Using Postman or similar
POST /api/reservations
GET /api/reservations/slots
PATCH /api/reservations/{id}
DELETE /api/reservations/{id}/cancel
```

### 4. E2E Tests

Test complete workflows:

```typescript
// tests/e2e/reservation-flow.test.ts
describe('Reservation Flow', () => {
  test('customer should be able to book table', async () => {
    // Visit storefront
    // Select date/time
    // Enter customer info
    // Confirm booking
    // Verify confirmation
  });
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All migrations applied successfully
- [ ] All tests passing (unit, integration, e2E)
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] API documentation reviewed
- [ ] Database backups created
- [ ] Environment variables configured

### Database

- [ ] Run migrations on staging
- [ ] Verify all tables created
- [ ] Verify all functions created
- [ ] Verify RLS policies in place
- [ ] Test data inserted for testing

### Backend

- [ ] Deploy Supabase functions
- [ ] Deploy server functions
- [ ] Verify API endpoints working
- [ ] Test rate limiting
- [ ] Test error handling

### Frontend

- [ ] Build production bundle
- [ ] Verify no console errors
- [ ] Test all new pages
- [ ] Test all new components
- [ ] Test responsive design
- [ ] Test on multiple browsers

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Set up performance monitoring
- [ ] Set up API monitoring
- [ ] Set up database monitoring
- [ ] Create alerts for critical errors

### Post-Deployment

- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Monitor API usage
- [ ] Gather user feedback
- [ ] Document any issues
- [ ] Plan follow-up improvements

---

## Rollback Plan

Jika ada issue setelah deployment:

### Step 1: Identify Issue

```bash
# Check error logs
tail -f /var/log/flowpos/error.log

# Check database logs
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

### Step 2: Rollback Database

```bash
# Rollback last migration
supabase db reset

# Or manually drop tables
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS loyalty_tiers CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
```

### Step 3: Rollback Code

```bash
# Revert to previous commit
git revert HEAD

# Or checkout previous version
git checkout v3.0.0

# Rebuild and redeploy
npm run build
npm run deploy
```

### Step 4: Verify

```bash
# Verify application working
curl https://api.flowpos.local/health

# Verify database integrity
SELECT COUNT(*) FROM reservations;
SELECT COUNT(*) FROM loyalty_tiers;
```

---

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_reservations_outlet_date 
  ON reservations(outlet_id, reservation_date);

CREATE INDEX idx_loyalty_points_user 
  ON loyalty_points(shop_id, user_id);

CREATE INDEX idx_api_usage_timestamp 
  ON api_usage(created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE 
SELECT * FROM reservations 
WHERE outlet_id = '...' AND reservation_date = '...';
```

### API Optimization

```typescript
// Implement caching
const cache = new Map();

export async function getCachedReservations(outletId: string) {
  const key = `reservations:${outletId}`;
  
  if (cache.has(key)) {
    return cache.get(key);
  }

  const data = await fetchReservations(outletId);
  cache.set(key, data);
  
  // Clear cache after 5 minutes
  setTimeout(() => cache.delete(key), 5 * 60 * 1000);
  
  return data;
}
```

### Frontend Optimization

```typescript
// Lazy load components
const ReservationForm = lazy(() => import('./ReservationForm'));
const LoyaltyTiers = lazy(() => import('./LoyaltyTiers'));

// Use React Query for data fetching
const { data, isLoading } = useQuery(
  ['reservations', outletId],
  () => fetchReservations(outletId),
  { staleTime: 5 * 60 * 1000 }
);
```

---

## Monitoring & Analytics

### Key Metrics

- **Reservation Metrics**:
  - Total bookings per day
  - Booking conversion rate
  - Average party size
  - Cancellation rate

- **Loyalty Metrics**:
  - Active members
  - Points earned/redeemed
  - Reward redemption rate
  - Referral conversion rate

- **API Metrics**:
  - Total API calls
  - Success rate
  - Average response time
  - Rate limit violations

### Dashboard

Create monitoring dashboard:

```typescript
// artifacts/kopihub/src/routes/admin.analytics.stage4.tsx
export function Stage4AnalyticsDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ReservationMetrics />
      <LoyaltyMetrics />
      <ApiMetrics />
    </div>
  );
}
```

---

## Support & Troubleshooting

### Common Issues

**Issue**: Reservation slots not generating
```sql
-- Check if reservation_settings is enabled
SELECT * FROM reservation_settings WHERE outlet_id = '...';

-- Manually generate slots
SELECT generate_reservation_slots('outlet_id', '2026-05-01', '2026-05-31');
```

**Issue**: API rate limit not working
```sql
-- Check api_usage table
SELECT COUNT(*) FROM api_usage 
WHERE api_key_id = '...' 
AND created_at > now() - INTERVAL '1 minute';

-- Verify rate_limit settings
SELECT * FROM api_keys WHERE id = '...';
```

**Issue**: Loyalty points not updating
```sql
-- Check loyalty_points table
SELECT * FROM loyalty_points WHERE user_id = '...';

-- Check loyalty_ledger for history
SELECT * FROM loyalty_ledger WHERE user_id = '...' ORDER BY created_at DESC;
```

---

## Next Steps

Setelah Stage 4 berhasil diimplementasikan:

1. **Gather User Feedback**: Kumpulkan feedback dari pengguna
2. **Monitor Performance**: Monitor metrics dan performance
3. **Plan Stage 5**: Rencanakan fitur untuk tahap berikutnya
4. **Document Learnings**: Dokumentasikan lessons learned
5. **Team Training**: Training tim tentang fitur baru

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
