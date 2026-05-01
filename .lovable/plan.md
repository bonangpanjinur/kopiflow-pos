
# Audit Menyeluruh & Rencana Pengembangan

## 1) Bug & Error yang Terdeteksi

### A. Runtime crash di `/app` — `TypeError: s.slice is not a function`
Konsol menunjukkan crash berulang saat memuat layout `/app`. Sumbernya **`src/components/owner-reminder-banner.tsx` baris 70** (`items.slice(0, ...)`).

Penyebab: `listMyNotifications()` dipanggil sebagai server function TanStack. Dalam beberapa kasus respons tidak berbentuk array (mis. saat user belum punya `shop_id` / RLS memfilter habis / proxy SSR mengembalikan objek `{result, context}`). State `items` menjadi non-array, lalu `.length` mengembalikan `undefined`, kondisi `=== 0` false, jalur render mencapai `.slice` dan error.

Perbaikan:
- Normalisasi: `setItems(Array.isArray(rows) ? rows : [])`
- Tambah guard: `const safeItems = Array.isArray(items) ? items : [];`
- Tambah ErrorBoundary lokal di `app.tsx` agar crash banner tidak menjatuhkan seluruh dashboard.

### B. Bug & Tech-debt lain (hasil scan)
1. `useEntitlements` tidak menangani `data.features` / `data.themes` jika RPC `get_shop_entitlements` return shape JSON — beberapa pemanggil bisa crash bila salah satunya null.
2. `app.online-orders.tsx` & `s.$slug.orders.tsx` belum subscribe Realtime → status order tidak refresh otomatis kecuali polling.
3. `app.appearance.tsx` belum mem-validasi entitlement secara server-side saat aktivasi (sudah ada di RPC `set_shop_theme`, tapi UI tidak menampilkan reason gating).
4. `OwnerReminderBanner` interval 5 menit polling — boros; pakai Realtime channel `owner_notifications`.
5. Kurir view (`/app/courier`): tidak ada filter outlet & tidak ada tombol "ambil pesanan" eksplisit (race condition kalau dua kurir sekaligus).
6. Tidak ada rate-limit di endpoint publik `/api/public/cron/*` selain secret — perlu IP allowlist atau dedupe `cron_runs`.
7. Sebagian route `/app/*` belum lazy-load → bundle awal besar (sumber lambatnya hydrate di mobile).

---

## 2) Gap Fitur per-Role

### Super Admin
Sudah ada: daftar toko, plan invoices, domain, plans CRUD basic, activity, dashboard stats, suspend.
Kurang:
- **Editor Plan→Feature/Theme** (UI matrix) — tabel `plan_features`/`plan_themes` ada tapi belum punya halaman GUI.
- **Catalog Editor** untuk `features` & `themes` (tambah/edit/sortir).
- **Broadcast/Pengumuman** ke semua owner (`owner_notifications` global).
- **Audit log viewer** terpadu (`branding_audit`, `domain_audit`, `system_audit`, `cron_runs`) dengan filter.
- **Refund/credit note** untuk plan_invoices.
- **Impersonate owner** (read-only) untuk troubleshooting.
- **Backup global**: trigger backup penuh tenant on-demand.

### Owner / Toko
Sudah ada: POS, menu, kategori, inventori, supplier, PO, resep, pegawai, jadwal, absensi, delivery, kurir, shift, laporan, promo, loyalty, billing, domain, appearance, settings.
Kurang:
- **Multi-outlet management UI** (tabel `outlets` ada, tapi route khusus belum lengkap untuk CRUD & switcher).
- **Customer database** terpusat (CRM ringan) — daftar pelanggan + total spend + last order + segmentasi.
- **Marketing**: broadcast WhatsApp/email ke pelanggan (template + segmen).
- **Reservation / table booking** untuk dine-in.
- **Tabel & QR per meja** (table service: scan QR meja → pesan langsung).
- **Modifier/varian menu** (size, sugar level, topping) — sekarang hanya item flat.
- **Bundling/combo deal** sebagai jenis promo lanjutan.
- **Expense tracking** (selain PO) — biaya operasional umum (listrik, gaji, sewa).
- **Cash flow & laba-rugi** otomatis (laporan keuangan).
- **Stock opname** (adjustment + reason + foto bukti).
- **Wastage / kehilangan stok** dengan kategori.
- **Print queue** untuk dapur (KOT) terpisah dari struk kasir.
- **Notifikasi push** (PWA + WebPush) untuk owner saat ada order online.
- **Integrasi payment gateway** (Midtrans/Xendit) — sekarang hanya QRIS manual + cash + transfer.
- **Backup & export data** (CSV/XLSX/JSON) per modul + scheduled backup.
- **Audit log per toko** (siapa edit menu/promo/harga).

### Pegawai (Cashier/Barista)
Sudah ada: POS, orders, shifts, inventory read, attendance.
Kurang:
- **Daily briefing/checklist** opening & closing.
- **Tip/komisi tracker** per shift.
- **Pesan internal antar staff** (chat ringan).
- **Notifikasi order baru** real-time (suara/badge).
- **Quick void/refund** dengan persetujuan owner (PIN).
- **Performance metrics** (jumlah order yg diproses, rata-rata waktu).

### Kurir
Sudah ada: list pengantaran, status update.
Kurang:
- **Klaim pesanan** atomic (`assign_courier_atomic` RPC) untuk hindari double-claim.
- **Navigasi GPS** (deeplink Google Maps) ke `delivery_address`.
- **Riwayat & earning** kurir (per pengantaran, total harian/bulanan).
- **Bukti pengiriman** (foto upload + tanda tangan).
- **Status real-time** ke pelanggan (track order live).
- **Mode offline** dengan queue sync.

### Pelanggan
Sudah ada: storefront, cart, checkout, orders, pay, track, profil cart customer.
Kurang:
- **Profil & alamat saved** (tabel `customer_addresses` ada, tapi UI minim).
- **Review & rating** menu.
- **Favorite items / re-order one-tap**.
- **Notifikasi push** status pesanan.
- **Loyalty dashboard** (poin, riwayat, redeem self-service).
- **Voucher/promo wallet** pelanggan.
- **Multi-shop discovery** (jika nanti ada marketplace pusat).
- **Referral code** (ajak teman dapat poin).
- **Kompleks pesan terjadwal** (pre-order untuk besok pagi) — kolom `scheduled_for` ada, UI belum.

---

## 3) Sistem Backup & Export Data

Tujuan: setiap toko bisa **backup** semua data operasional + pelanggan, untuk audit, migrasi, atau pemulihan.

Komponen:
1. **Per-modul export** (instant):
   - Tombol "Export CSV/XLSX" di tiap halaman: Menu, Inventori, Orders, Pelanggan, Promo, Loyalty ledger, Shift, PO, Absensi, Pegawai.
2. **Backup Penuh (Snapshot)**:
   - Tabel baru `shop_backups (id, shop_id, requested_by, status, file_url, size_bytes, includes jsonb, created_at, completed_at)`.
   - Server function `requestShopBackup` → background job: kumpulkan semua tabel terkait shop_id, susun file `backup-{slug}-{date}.zip` berisi `*.json` + `manifest.json` + `README.txt`, upload ke Supabase Storage bucket `shop-backups` (private), simpan signed URL berlaku 7 hari.
   - Batas: 1 backup per 24 jam (rate-limit).
3. **Scheduled backup** (Pro+):
   - Tabel `backup_schedules (shop_id, frequency, retention_days, next_run_at)`.
   - Cron `/api/public/cron/backups` jalan harian, eksekusi yang due, hapus snapshot lama > retention.
4. **Restore (Pro Plus / Super Admin)**:
   - Wizard upload file backup → preview → "dry-run" → apply per-tabel (transaksional).
   - Restore selalu ditulis ke audit log.
5. **Customer self-export** (GDPR-ready):
   - Pelanggan bisa request "Unduh data saya" (orders, addresses, loyalty). Email link.
6. **Storage**:
   - Bucket `shop-backups` private, RLS: hanya owner toko terkait.
   - Bucket `customer-exports` private, RLS: hanya pemilik user_id.

---

## 4) Rencana Pengembangan Bertahap (Roadmap)

Disusun jadi **6 sprint (H1–H6)**. Boleh dieksekusi berurutan; tiap sprint ≈ 1 batch implementasi.

### H1 — Stabilisasi (PRIORITAS TINGGI)
- Fix `OwnerReminderBanner` + ErrorBoundary di `/app`.
- Hardening `useEntitlements` (default array kosong, retry).
- Realtime subscription untuk `owner_notifications` (gantikan polling).
- Lazy-load route berat: reports, admin.*, purchase-orders.
- Atomic `assign_courier(_order_id)` RPC + UI klaim kurir.
- Tambah validasi server di `set_shop_theme` (sudah ada) + tampilkan reason gating di UI.

### H2 — Data Backup & Export
- Tabel `shop_backups`, `backup_schedules`, bucket Storage + RLS.
- Server fn `requestShopBackup`, `listShopBackups`, `downloadShopBackup`.
- Halaman `/app/backup` (owner): tombol "Backup sekarang", riwayat, jadwal otomatis (gated Pro+).
- Per-modul "Export CSV" universal helper di `src/lib/export.ts`.
- `/api/public/cron/backups` + cron entry.
- Customer "Download my data" di `/s/$slug` profil.

### H3 — CRM Pelanggan + Marketing
- Tabel `shop_customers` (denormalized view dari orders + customer_user_id) — atau view materialized.
- Halaman `/app/customers`: list + filter + segmentasi (RFM ringan).
- Tabel `customer_segments`, `marketing_campaigns`, `campaign_recipients`.
- Broadcast WhatsApp link / email (template `{{nama}}`, `{{poin}}`).
- Halaman pelanggan: `/s/$slug/me` (profil, alamat, poin, voucher, history, favorit).
- Referral code system.

### H4 — Operasional & Keuangan
- **Modifier/varian menu** (`menu_item_options`, `menu_item_option_values`) + UI POS picker.
- **Bundling/combo** sebagai promo type baru.
- **Stock opname** (`stock_adjustments` dengan reason + foto).
- **Expense tracker** (`expenses` non-PO) + masuk laporan laba-rugi.
- **Laporan P&L bulanan** otomatis.
- **Reservation & QR table** (`tables`, `reservations`, route `/s/$slug/t/$tableCode`).
- **Push notif** (PWA WebPush) untuk owner & pelanggan.

### H5 — Super Admin Power Tools
- Halaman `/admin/plans/$id/matrix` — matrix Plan × Feature/Theme dengan toggle & min-months inline.
- Halaman `/admin/catalog/features` & `/admin/catalog/themes` (CRUD).
- Halaman `/admin/broadcast` (kirim notif global → semua owner / per plan).
- Halaman `/admin/audit` terpadu (filter actor, action, shop, range tanggal).
- Impersonate owner (`admin_impersonate_token` dengan TTL 15 menit, audit).
- Refund/credit note untuk `plan_invoices`.

### H6 — Skala & Polish
- Multi-outlet switcher di header `/app`.
- Print queue dapur (KOT) terpisah, mendukung printer Bluetooth/ESC-POS.
- Integrasi Midtrans/Xendit (gantikan QRIS manual untuk Pro+).
- Mode offline POS (IndexedDB queue → sync).
- Performance budget: code-split per route, prefetch on hover, image CDN.
- A11y audit + i18n (en/id) toggle.

---

## 5) Detail Teknis (untuk implementasi)

### Database tambahan (akan di sprint terkait)
```text
shop_backups        — snapshot per toko
backup_schedules    — jadwal otomatis
shop_customers      — view/cache CRM
customer_segments   — segmentasi
marketing_campaigns — broadcast
menu_item_options   — varian/modifier
stock_adjustments   — opname & wastage
expenses            — biaya operasional
tables, reservations
push_subscriptions  — WebPush endpoints
expense_categories
```

### Storage buckets
- `shop-backups` (private, RLS: owner toko)
- `customer-exports` (private, RLS: user_id)
- `delivery-proofs` (private, RLS: kurir + owner toko + customer)
- `kot-receipts` (opsional)

### RPC tambahan
- `assign_courier_atomic(_order_id)` — dengan SELECT … FOR UPDATE
- `request_shop_backup(_shop_id)` — enqueue
- `apply_shop_restore(_backup_id, _scope text[])` — transaksional
- `admin_broadcast_notification(_audience, _title, _body, _link)`
- `admin_impersonate(_shop_id)` → returns short-lived token
- `customer_export_request(_user_id)` → enqueue

### Konvensi UI
- Setiap fitur "Pro/Pro Plus" gunakan komponen `<EntitlementGate feature="...">` baru di `src/components/entitlement-gate.tsx` (centralize gating + CTA upgrade).
- Setiap halaman daftar pakai `<ExportButton table="..." />` reusable.

---

## 6) Saran Eksekusi

Mulai dari **H1 (Stabilisasi)** dulu — wajib karena ada crash aktif di `/app`. Kemudian **H2 (Backup)** karena permintaan eksplisit user. Sprint berikutnya bisa dipilih sesuai prioritas bisnis.

Setelah Anda menyetujui rencana ini, saya usulkan langsung eksekusi **H1 + H2** dalam 1–2 batch implementasi:
1. Batch 1: H1 lengkap (fix bug, lazy-load, atomic kurir, ErrorBoundary).
2. Batch 2: H2 lengkap (backup + export + customer self-export).

Jika setuju atau ingin mengubah prioritas (mis. mau H3 CRM dulu), beri tahu sebelum approve.
