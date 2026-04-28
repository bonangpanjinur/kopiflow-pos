# Plan: 4 Batch Penyempurnaan KopiHub

Tanpa payment gateway (tetap manual QRIS). Semua dikerjakan bertahap, 1 batch = 1 sesi besar. Saya rekomendasikan eksekusi berurutan **Batch 4 → 5 → 7 → 6** karena Batch 6 (push notif & live tracking) paling kompleks.

---

## BATCH 4 — Money: Shift, Refund, Split Payment, Multi-tax

### Tujuan
Owner punya kontrol kas penuh: tahu berapa uang di laci awal/akhir shift, bisa refund, bisa terima pembayaran campuran.

### Database
Migrasi baru:
- Tabel **`cash_shifts`**: `id, outlet_id, shop_id, opened_by, opened_at, opening_cash, closed_by, closed_at, closing_cash, expected_cash, variance, note, status (open/closed)`.
- Tabel **`cash_movements`**: `id, shift_id, type (in/out/sale/refund), amount, note, created_by, created_at` — log semua arus kas dalam shift.
- Tabel **`refunds`**: `id, order_id, amount, reason, refund_method, created_by, created_at`.
- Kolom baru di `orders`:
  - `shift_id uuid` (link ke shift saat order dibuat)
  - `tip_amount numeric default 0`
  - `service_charge numeric default 0`
  - `payment_split jsonb default '[]'` — array `[{method, amount}]` untuk split payment
- Kolom baru di `coffee_shops`:
  - `tax_percent numeric default 0`
  - `service_charge_percent numeric default 0`
  - `tax_inclusive boolean default false`
- RPC **`open_shift(_outlet_id, _opening_cash)`** & **`close_shift(_shift_id, _closing_cash, _note)`** dengan auto-hitung expected & variance.
- RPC **`refund_order(_order_id, _amount, _reason, _method)`** — insert refund + cash_movement, update order.payment_status='refunded'.

### UI
- **`app.shifts.tsx`** (route baru): list shift, detail (cash in/out, sales, expected vs actual). Tombol "Buka Shift" & "Tutup Shift".
- **`app.pos.tsx`**: 
  - Block POS jika tidak ada shift open (banner "Buka shift dulu").
  - Tombol "Split Payment" di dialog bayar → 2+ input method+amount, validasi total.
  - Input tip & service charge opsional.
  - Auto-isi `shift_id` saat create order.
- **`app.orders.tsx`**: tombol "Refund" di detail order (parsial atau penuh) dengan dialog alasan.
- **`app.settings.tsx`**: section Pajak & Service (% pajak, % service, tax inclusive toggle).
- **`receipt.tsx`**: tampilkan tip, service, split payment breakdown.

---

## BATCH 5 — Inventory Pro: Low Stock, HPP, Supplier, PO

### Tujuan
Owner tidak kehabisan bahan baku tanpa sadar; tahu margin tiap menu; bisa kelola supplier & purchase order.

### Database
Migrasi:
- Tabel **`suppliers`**: `id, shop_id, name, contact_name, phone, email, address, note, is_active`.
- Tabel **`purchase_orders`**: `id, shop_id, supplier_id, po_no, status (draft/sent/received/cancelled), order_date, received_date, total, note, created_by`.
- Tabel **`purchase_order_items`**: `id, po_id, ingredient_id, quantity, unit_cost, subtotal`.
- Kolom baru `ingredients`:
  - `supplier_id uuid` (default supplier)
  - `last_purchase_cost numeric` (auto-update saat PO received)
- Trigger: saat `purchase_orders.status` berubah ke `received`, auto-insert `stock_movements` type='purchase' untuk semua item + update `ingredients.last_purchase_cost`.
- View **`menu_hpp_view`**: hitung HPP per menu = SUM(recipe.qty * ingredient.cost_per_unit) → owner lihat margin.

### UI
- **`app.suppliers.tsx`** (route baru): CRUD supplier.
- **`app.purchase-orders.tsx`** (route baru): list PO, create PO (pilih supplier + add items), tombol "Tandai Diterima".
- **`app.inventory.tsx`**: 
  - Badge merah untuk ingredient yang `current_stock < min_stock`.
  - Filter "Stok Menipis".
  - Tombol "Stock Opname" → dialog input stok aktual + alasan, otomatis insert `stock_movements` type='adjustment'.
- **`app.menu.tsx`**: kolom HPP & margin per item (dari view).
- **`app.index.tsx`** (dashboard): widget "Stok menipis" (top 5 ingredient di bawah min_stock).
- Notif toast di sidebar saat ada low stock (poll tiap 5 menit).

---

## BATCH 6 — Customer Delight: Push Notif, Review, Live Tracking, Voucher

### Tujuan
Customer dapat notifikasi otomatis, bisa rating, bisa lacak kurir live, bisa share voucher.

### Database
Migrasi:
- Tabel **`order_reviews`**: `id, order_id, shop_id, user_id, rating (1-5), comment, created_at`.
- Tabel **`menu_reviews`** (turunan otomatis dari order_reviews): `id, menu_item_id, order_id, user_id, rating, created_at`.
- Tabel **`courier_locations`**: `id, courier_id, order_id, lat, lng, updated_at` — kurir kirim posisi tiap 30 detik saat status='delivering'.
- Tabel **`push_subscriptions`**: `id, user_id, endpoint, p256dh, auth, created_at` (Web Push API).
- Kolom baru `promos`: `is_referral boolean default false`, `referrer_user_id uuid` — voucher yang dibagikan customer.

### UI / Logic
- **PWA Service Worker** (`public/sw.js`): handle push events, cache shell.
- **`s.$slug.orders.tsx`**: 
  - Tombol "Beri Rating" di order completed → dialog 5-star + komentar per menu.
  - Tampilkan rating rata-rata di setiap order history.
- **`track.$orderId.tsx`**: 
  - Embed Leaflet map (open-source, no API key) menampilkan posisi kurir live.
  - Subscribe realtime ke `courier_locations`.
- **`app.courier.tsx`**: 
  - Auto-share location pakai `navigator.geolocation.watchPosition` saat order status='delivering'.
- **`s.$slug.menu.$menuId.tsx`**: tampilkan rating + review terbaru per menu.
- **`s.$slug.checkout.tsx`**: input "Kode referral" → validasi & apply.
- **Push notification flow**:
  - Setelah login customer, prompt "Aktifkan notifikasi" → register service worker → simpan subscription.
  - Trigger via DB trigger pada `orders` status change → call edge endpoint `/api/public/push-notify` → kirim Web Push.

### Catatan teknis
- Web Push butuh VAPID keys (generate sekali, simpan sebagai env var).
- Map: pakai **Leaflet + OpenStreetMap** (gratis, tanpa API key).
- Voucher referral: setiap customer punya kode unik auto-generate.

---

## BATCH 7 — Analytics Pro: Charts, Export, Best-seller, Shift Report

### Tujuan
Owner punya dashboard insight bisnis dengan grafik & bisa export laporan.

### Database
- View **`sales_hourly_view`**: agregat penjualan per jam.
- View **`menu_performance_view`**: penjualan per menu (qty, revenue, %).
- View **`shift_summary_view`**: ringkasan per shift (sales, refund, variance).

### UI
- **`app.index.tsx`** (dashboard revamp):
  - Line chart: penjualan 7/30 hari (Recharts, sudah di stack).
  - Bar chart: jam tersibuk hari ini.
  - Pie chart: revenue per kategori.
  - Comparison card: minggu ini vs minggu lalu (% growth).
- **`app.reports.tsx`**:
  - Tab baru: **Best-seller** (sortable table per menu, filter range tanggal).
  - Tab baru: **Shift Report** (X-report = shift berjalan, Z-report = shift ditutup).
  - Tombol **Export PDF** & **Export Excel** untuk semua tab — pakai library `jspdf` + `xlsx`.
- **Email harian** (opsional, pakai cron pg_net):
  - Cron `0 22 * * *` → call `/api/public/daily-report` → kirim email summary ke owner.
  - Skip kalau email infra belum setup, fallback: simpan di tabel `daily_reports` untuk dilihat owner.

---

## Yang TIDAK Dikerjakan

- Payment gateway (Midtrans/Xendit) — sesuai keputusan, tetap manual QRIS.
- Multi-outlet switcher (cukup 1 outlet untuk fase ini).
- Push notif iOS Safari (butuh setup khusus, coverage rendah).
- GoFood/GrabFood integration (butuh akses partner API).
- Email transactional otomatis ke customer (butuh domain custom).

---

## Detail Teknis Singkat

| Batch | Tabel baru | RPC baru | Library tambahan |
|-------|------------|----------|------------------|
| 4 | cash_shifts, cash_movements, refunds | open_shift, close_shift, refund_order | — |
| 5 | suppliers, purchase_orders, purchase_order_items | (trigger only) | — |
| 6 | order_reviews, courier_locations, push_subscriptions | — | leaflet, web-push |
| 7 | (views only) | — | jspdf, xlsx |

Semua RLS akan mengikuti pattern eksisting (`owner_all` + role-specific).

---

## Pertanyaan Eksekusi

Apakah saya mulai dari **Batch 4 (Money)** dulu sekarang? Atau Anda mau urutan lain?
