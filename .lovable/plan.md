
# Custom Domain Pro + Billing Super Admin

URL Free tetap `domain.com/s/{slug}`. Plan Pro membuka fitur custom domain (mis. `kopikukamu.com`) yang disambungkan via reverse proxy / Cloudflare for SaaS di depan project. Pembayaran fase pertama: transfer manual + upload bukti, super admin yang verifikasi & meng-aktifkan plan. Role super admin di-assign manual via SQL nanti.

## 1. Skema Database (migration)

Tambah kolom & tabel:

```sql
-- Plan & domain di shop
alter table coffee_shops
  add column plan text not null default 'free',
  add column plan_expires_at timestamptz,
  add column custom_domain text unique,
  add column custom_domain_verified_at timestamptz,
  add column custom_domain_verify_token text;

-- Role super admin (extend enum app_role)
alter type app_role add value if not exists 'super_admin';

-- Paket yang dijual
create table plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price_idr int not null,
  duration_days int not null,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Pengaturan rekening tujuan super admin
create table billing_settings (
  id int primary key default 1 check (id = 1),
  bank_name text, account_no text, account_name text,
  qris_image_url text, instructions text,
  updated_at timestamptz default now()
);

-- Tagihan / invoice
create table plan_invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references coffee_shops(id) on delete cascade,
  plan_id uuid not null references plans(id),
  invoice_no text unique not null,
  amount_idr int not null,
  status text not null default 'pending',  -- pending|awaiting_review|paid|rejected|expired
  payment_method text,
  payment_proof_url text,
  paid_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- Audit perubahan domain
create table domain_audit (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  old_domain text, new_domain text,
  action text,  -- request|verify|remove|reject
  actor_id uuid,
  created_at timestamptz default now()
);
```

RLS:
- `plans`, `billing_settings`: SELECT untuk authenticated; tulis hanya `has_role(uid,'super_admin')`.
- `plan_invoices`: owner toko bisa SELECT/INSERT untuk shop miliknya, UPDATE hanya field `payment_proof_url` saat status `pending|awaiting_review`; super_admin full access.
- `coffee_shops`: kolom `custom_domain` boleh diubah owner; `plan`, `plan_expires_at`, `custom_domain_verified_at` hanya super_admin (lewat RPC).
- `domain_audit`: owner SELECT shop sendiri; super_admin semua.

Storage bucket `payment-proofs` sudah ada — tambah RLS owner-shop & super_admin.

## 2. Server Functions Kunci

`src/server/billing.functions.ts`
- `createPlanInvoice({ planCode })` → buat invoice `pending` untuk shop user.
- `submitPaymentProof({ invoiceId, proofUrl })` → status `awaiting_review`.
- `approveInvoice({ invoiceId })` (super_admin) → set `paid`, update shop `plan='pro'`, `plan_expires_at = now + duration_days`.
- `rejectInvoice({ invoiceId, reason })`.

`src/server/domain.functions.ts`
- `requestCustomDomain({ domain })` → validasi format, simpan + token `_kopihub-verify=...`, status unverified, audit `request`.
- `verifyCustomDomain()` → DNS lookup TXT (`dns/promises`); jika cocok set `custom_domain_verified_at`, audit `verify`.
- `removeCustomDomain()`.
- `resolveShopByHost({ host })` (server) → cari shop by `custom_domain` verified.

Semua dilindungi `requireSupabaseAuth` + cek role/ownership.

## 3. Multi-tenant Host Routing

Di `__root.tsx` tambah loader server fn `resolveHost()`:
1. Baca `host` header (server-only).
2. Jika host = domain platform → app normal.
3. Jika cocok dengan shop verified → render `s.$slug` untuk shop tsb tanpa redirect (URL tetap bersih). Implementasi: simpan `tenantSlug` di route context, di `s.$slug.index.tsx` fallback baca dari context bila slug param kosong, atau buat route `__root` yang me-mount layout `s/$slug` saat host adalah custom domain.
4. Jika host tidak dikenal → 404 ramah.

Cloudflare for SaaS: kamu (admin platform) yang menambahkan hostname pelanggan ke Cloudflare via API setelah verifikasi DNS — itu langkah operasional, tidak masuk kode aplikasi.

## 4. UI Owner Toko

- `src/lib/use-plan.ts` — hook `{plan, isPro, expiresAt}`.
- `src/routes/app.billing.tsx` — daftar paket, tombol "Upgrade", daftar invoice, upload bukti, status, info rekening tujuan.
- `src/routes/app.domain.tsx` — gated Pro:
  - Form input domain.
  - Instruksi DNS (A record + TXT verify).
  - Tombol "Cek Verifikasi" (panggil `verifyCustomDomain`).
  - Status: pending / verified / failed.
  - Tombol hapus + audit log singkat.
- `src/routes/app.tsx` (sidebar) — tambah menu "Plan & Tagihan", "Domain Kustom" (badge Pro/gembok bila Free).
- `src/routes/app.index.tsx` — banner: kalau punya domain verified, tampilkan link `https://{domain}` selain `/s/{slug}`.

## 5. UI Super Admin (`/admin/*`)

Guard layout `admin.tsx` → `has_role(uid,'super_admin')` else redirect.
- `admin.index.tsx` — KPI: total toko, Pro aktif, Pro expired 7 hari ke depan, invoice menunggu review, MRR (jumlah invoice paid bulan ini).
- `admin.shops.tsx` — daftar semua toko + filter plan, ubah plan manual, perpanjang/expire, lihat owner & domain.
- `admin.invoices.tsx` — antrian `awaiting_review` paling atas, preview bukti, tombol Approve/Reject + alasan.
- `admin.plans.tsx` — CRUD paket (harga, durasi, fitur JSON).
- `admin.domains.tsx` — semua custom domain, status verifikasi, force-verify, remove, audit log.
- `admin.settings.tsx` — atur rekening tujuan & instruksi pembayaran.

## 6. Alur Pembayaran (Manual)

```text
Owner -> Billing -> pilih paket -> invoice 'pending'
     -> halaman invoice tampilkan rekening + nomor invoice
     -> upload bukti -> status 'awaiting_review'
Super Admin -> Invoices -> review bukti
     -> Approve: invoice 'paid', shop.plan='pro', plan_expires_at=+duration
     -> Reject: invoice 'rejected' + catatan
Cron ringan saat owner login -> if plan_expires_at<now: shop.plan='free'
     (custom domain dipertahankan tapi tidak disajikan sampai upgrade lagi)
```

## 7. Fase Implementasi (3 batch)

**Batch A — Fondasi**
- Migration plan/role/invoices/domain_audit + seed paket default.
- `usePlan()` hook + sidebar gating.
- Layout `/admin` + role guard + halaman shops & plans.

**Batch B — Billing manual**
- `app/billing` (buat invoice, upload bukti).
- `admin/invoices` (review & approve/reject + auto aktifkan plan).
- `admin/settings` (rekening tujuan).

**Batch C — Custom Domain**
- `app/domain` (form, instruksi DNS, verifikasi).
- Server fn DNS check + audit.
- Multi-tenant host routing di `__root.tsx`.
- `admin/domains`.

## Catatan Teknis Penting

- Super admin pertama: di-assign manual via SQL (`insert into user_roles(user_id, role) values ('<uid>', 'super_admin');`).
- Tidak pakai gateway pembayaran di fase ini; struktur invoice sudah cukup untuk menambahkan Midtrans/Xendit nanti tanpa migrasi besar.
- Custom domain butuh aksi operasional di Cloudflare for SaaS (di luar app) untuk hostname pelanggan & SSL — UI hanya menangani verifikasi DNS & registrasi di DB.
- Semua perubahan domain & approval invoice tercatat di tabel audit untuk transparansi.

