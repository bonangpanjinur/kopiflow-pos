## Batch D: Plan Lifecycle & Domain Enforcement

Otomatisasi siklus hidup plan Pro dan keamanan custom domain agar tetap konsisten tanpa intervensi manual.

### 1. Cron Endpoint: Plan Maintenance
Buat `src/routes/api/public/cron/plan-maintenance.ts` (POST) yang dijalankan harian via `pg_cron` + `pg_net`:
- **Auto-downgrade**: Cari `coffee_shops` dengan `plan='pro'` dan `plan_expires_at < now()` → set `plan='free'`, kosongkan `custom_domain_verified_at` (domain tetap tersimpan tapi tidak aktif).
- **Re-verifikasi DNS berkala**: Untuk shop dengan `custom_domain_verified_at IS NOT NULL`, lakukan DoH lookup TXT record. Jika hilang/berubah → set `custom_domain_verified_at = NULL` dan log ke `domain_audit` sebagai `auto_unverify`.
- **Reminder invoices**: Tandai invoice `pending` yang berumur > 7 hari sebagai `expired` (status baru) supaya owner tahu harus buat invoice baru.
- Auth: header `x-cron-secret` cocok dengan secret `CRON_SECRET`.

### 2. SQL Migration
- Tambah RPC `expire_overdue_plans()` SECURITY DEFINER yang mengembalikan list shop_id yang di-downgrade (dipanggil dari cron route via service role).
- Tambah kolom `last_dns_check_at` di `coffee_shops` untuk throttling re-verifikasi (skip jika < 6 jam terakhir).
- Tambah tabel `domain_blacklist` (domain text PK) berisi reserved hostnames: `localhost`, `admin`, `api`, `www`, `app`, `lovable.app`, `lovableproject.com`, dst.
- Update server function `requestCustomDomainVerification` (di `domain.functions.ts`) untuk menolak domain di blacklist + rate-limit (max 5 verifikasi per shop per jam) via tabel `domain_verify_attempts`.

### 3. Cron Schedule (via SQL insert tool)
Jadwalkan via `pg_cron`:
```text
plan-expire-daily   → 0 2 * * *  (02:00 WIB-ish)
domain-recheck-6h   → 0 */6 * * *
```
Memanggil `https://project--{id}.lovable.app/api/public/cron/plan-maintenance` dengan header `x-cron-secret`.

### 4. Owner UX
- Di `app.billing.tsx`: tampilkan banner kuning bila `plan_expires_at` < 7 hari, merah bila sudah expired.
- Di `app.domain.tsx`: tampilkan badge "Auto-unverified" + tombol "Verifikasi ulang" bila domain offline karena DNS recheck gagal.

### 5. Admin Visibility
- Di `admin.shops.tsx` (atau `admin.domains.tsx`): kolom status plan (Active/Expiring soon/Expired) + filter.
- Di `admin.index.tsx`: KPI tambahan "Pro shops aktif", "Expiring < 7 hari", "Domain offline".

### Secret yang dibutuhkan
- `CRON_SECRET` — random string untuk auth cron endpoint (akan diminta via `add_secret`).

### File yang akan dibuat/diubah
- **Baru**: `src/routes/api/public/cron/plan-maintenance.ts`
- **Baru**: `supabase/migrations/{timestamp}_batch_d_plan_lifecycle.sql`
- **Edit**: `src/server/domain.functions.ts` (blacklist + rate-limit)
- **Edit**: `src/routes/app.billing.tsx` (banner expiry)
- **Edit**: `src/routes/app.domain.tsx` (auto-unverified badge)
- **Edit**: `src/routes/admin.shops.tsx` & `admin.index.tsx` (KPI plan)
- **SQL insert (bukan migrasi)**: jadwal `pg_cron`

Setelah approve, saya minta `CRON_SECRET` lalu eksekusi semua langkah di atas dalam satu batch.