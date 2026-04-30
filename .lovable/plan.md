
# Theme Marketplace + Dynamic Plan/Feature System

Saat ini paket hanya `free`/`pro` (hardcode). Storefront pakai 1 layout. Kita ubah jadi: super admin definisikan **paket apa saja**, **fitur apa saja**, **tema apa saja**, dan **aturan add-on** (mis. custom domain butuh Pro min 1 tahun atau Pro Plus min 6 bulan). Owner pilih tema dari yang tersedia di paketnya.

## Konsep Inti

3 sumbu yang dapat dikelola admin:

1. **Plans** (sudah ada) — basic, pro, pro plus, dst. Bisa ditambah/diatur.
2. **Features** (baru) — kapabilitas atomik: `custom_domain`, `online_orders`, `loyalty`, `multi_outlet`, `theme_picker`, dst.
3. **Themes** (baru) — varian visual storefront (`classic`, `minimal`, `dark-luxe`, `vibrant`, …).

Lalu 2 tabel relasi yang menghubungkan plan → fitur & plan → tema, plus aturan tambahan (`requires_min_months`).

## Database

### Tabel baru

- **`features`** — katalog fitur global
  - `key` (slug unik, mis. `custom_domain`), `name`, `description`, `category` (`storefront`/`pos`/`add_on`), `is_active`
- **`themes`** — katalog desain storefront
  - `key`, `name`, `preview_image_url`, `description`, `tier_hint` (info), `component_id` (mis. `classic`, `minimal`), `is_active`, `sort_order`
- **`plan_features`** — fitur yang termasuk dalam tiap paket
  - `plan_id`, `feature_key`, `requires_min_months` (int, opsional → fitur baru aktif kalau langganan saat ini ≥ X bulan), `limit_value` (int opsional, mis. jumlah tema), `meta` (jsonb)
  - PK: (`plan_id`, `feature_key`)
- **`plan_themes`** — tema yang boleh dipilih owner per paket
  - `plan_id`, `theme_key`, `requires_min_months`
  - PK: (`plan_id`, `theme_key`)

### Modifikasi `coffee_shops`

- Tambah `active_theme_key text` (default `'classic'`) — tema yang dipilih owner
- Tambah `plan_started_at timestamptz` — kapan langganan saat ini dimulai (untuk hitung "min X bulan")
- (`plan` & `plan_expires_at` tetap; nilainya jadi kode plan dari tabel `plans`, bukan literal `pro`)

### RPC baru (security definer)

- `get_shop_entitlements(_shop_id)` → returns `{ plan_code, expires_at, months_active, features: [{key, allowed, reason}], themes: [{key, allowed, reason}] }`
  Logika:
  - hitung `months_active = (now - plan_started_at)/30`
  - untuk tiap baris di `plan_features`/`plan_themes` dengan plan saat ini: `allowed = months_active ≥ requires_min_months`
  - kalau plan expired, fallback ke plan `basic`/`free`
- `set_shop_theme(_shop_id, _theme_key)` → validasi tema termasuk dalam entitlements, lalu update `coffee_shops.active_theme_key`
- `admin_upsert_plan_feature(_plan_id, _feature_key, _requires_min_months, _limit_value, _meta)` — super admin
- `admin_remove_plan_feature(_plan_id, _feature_key)` — super admin
- `admin_upsert_plan_theme(_plan_id, _theme_key, _requires_min_months)` — super admin
- `admin_remove_plan_theme(_plan_id, _theme_key)` — super admin

### RLS

- `features`, `themes`, `plan_features`, `plan_themes`: SELECT untuk semua authenticated (& public utk themes/features katalog supaya halaman pricing publik bisa render); ALL hanya `super_admin`.
- `coffee_shops.active_theme_key`: update via RPC `set_shop_theme` (validasi entitlement); kolom ditolak via policy biasa kalau langsung diupdate dengan tema yang tidak entitled (cek di RPC saja, simple).

### Seed

Insert paket `basic` (gratis), `pro`, `pro_plus`. Insert fitur inti (`online_orders`, `loyalty`, `multi_outlet`, `custom_domain`, `theme_picker`, `priority_support`, `advanced_reports`). Insert 4 tema dummy (`classic`, `minimal`, `dark-luxe`, `vibrant`). Mapping awal:
- basic: classic
- pro: classic, minimal, dark-luxe (3 tema), `custom_domain` dengan `requires_min_months=12`
- pro_plus: 4 tema, `custom_domain` dengan `requires_min_months=6`, `priority_support`, `advanced_reports`

## Backend (server functions)

`src/server/entitlements.functions.ts` (baru):
- `getEntitlements()` — auth, panggil RPC `get_shop_entitlements` untuk shop owner
- `setShopTheme({ themeKey })` — auth, panggil RPC `set_shop_theme`
- `getPublicThemeForSlug({ slug })` — public, balikan `active_theme_key` + plan untuk render storefront

`src/server/admin-plans.functions.ts` (baru): CRUD plan_features & plan_themes (super admin only).

## Frontend

### Hook baru `useEntitlements()`
Ganti `usePlan()` di tempat-tempat gating. Hasil: `{ plan_code, hasFeature(key), themes: AllowedTheme[], loading }`. Backward-compat: ekspos `isPro` (= bukan `basic`).

Update file gating existing:
- `src/routes/app.domain.tsx` — gunakan `hasFeature("custom_domain")` (sudah include cek min-months); pesan error baru kalau belum memenuhi durasi.
- `src/routes/app.tsx` (suspended check tetap)
- `src/routes/app.loyalty.tsx`, dll. yang pakai `isPro` → migrasi ke `hasFeature(...)`.

### Halaman owner: `src/routes/app.appearance.tsx` (baru)
- Grid tema yang allowed (dengan preview), dan tema yang locked (dengan label "Butuh Pro Plus" / "Butuh berlangganan ≥ 6 bulan").
- Tombol "Aktifkan tema" memanggil `setShopTheme`.
- Tampilkan plan saat ini & sisa hari.

### Storefront dinamis
Refactor `src/routes/s.$slug.index.tsx`:
- Pisahkan UI ke `src/components/storefront/themes/{classic,minimal,dark-luxe,vibrant}/Home.tsx`. Tiap tema export `Home`, `Header`, `MenuCard`.
- Loader parent `s.$slug.tsx` ambil `active_theme_key` dari shop. Index page render `<ThemeRegistry themeKey={...} page="home" />` yang dynamic-import komponen tema (lazy, code-split).
- Fallback ke `classic` kalau key tidak dikenal / tema tidak aktif lagi.

(Untuk batch pertama: implement 2 tema fungsional — `classic` (refactor existing) & `minimal` — sisanya bisa skeleton dulu agar admin sudah bisa setup.)

### Halaman admin
Refactor `src/routes/admin.plans.tsx` jadi tabbed:
- Tab **Paket**: edit plan (existing, ditambah toggle `is_signup_default` + edit code).
- Tab **Fitur per Paket**: untuk paket terpilih → daftar fitur, toggle on/off, set `requires_min_months`.
- Tab **Tema per Paket**: pilih tema yang termasuk + `requires_min_months`.
- Tab **Katalog Fitur** & **Katalog Tema** (CRUD baris katalog).

## Halaman pricing publik
Update halaman billing/pricing supaya render dinamis dari `plans + plan_features + plan_themes` (bukan hardcode "pro"). User lihat: "Paket Pro Plus — 4 tema, custom domain (min 6 bulan), …".

## Migrasi data existing

- Shop dengan `plan='free'` → set ke `basic` (insert plan basic dulu).
- Shop dengan `plan='pro'` → set `plan_code='pro'`, isi `plan_started_at = COALESCE(plan_started_at, now() - 30 days)` agar tetap menikmati fitur saat ini.
- Set semua shop `active_theme_key='classic'`.

## Out of scope (batch berikutnya)

- Implementasi visual penuh untuk 4 tema (batch ini cukup 2 tema kerja + 2 placeholder).
- Payment gateway (sesuai keinginan kamu, tetap manual transfer dulu).
- Theme customization per-shop (warna brand, font) — saat ini owner cuma pilih tema, tweak detail dilakukan via Settings → Branding existing.

## Risiko & Mitigasi

- **Breaking gating**: kode yang sekarang cek `plan === 'pro'` literal. Mitigasi: hook `useEntitlements` juga ekspos `isPro` agar transisi mulus; saya update semua file pemakai dalam batch yang sama.
- **Storefront break saat refactor**: mitigasi dengan fallback `classic` selalu ada, dan refactor pertama hanya membungkus existing UI ke folder `themes/classic/` (tanpa mengubah markup).
- **`requires_min_months` membingungkan owner**: UI menjelaskan jelas — "Tersedia setelah 6 bulan berlangganan Pro Plus" + counter.

Setujui plan ini? Setelah approve saya jalankan migration + kode dalam 1 batch.
