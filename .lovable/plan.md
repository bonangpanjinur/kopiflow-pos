## Status Saat Ini (Sudah Selesai)

- **Fase 1 — Fondasi**: Auth (email + Google), onboarding shop/outlet, layout app, RLS dasar, role pemilik
- **Fase 2 — Katalog**: Kategori, menu/produk, manajemen harga
- **Fase 3 — POS Inti**: Multi-cart parking orders (DB-backed), Open Bills realtime, checkout Cash/QRIS, struk thermal 58mm, halaman Orders harian, persistence + sync antar device

## Yang Belum Dibangun — Roadmap Per Fase

### Fase 4 — Stok & Inventori
Kontrol bahan & ketersediaan menu agar tidak overselling.
- Tabel `ingredients`, `recipes` (BOM: menu → ingredient × qty), `stock_movements`
- Auto-decrement stok saat order completed (via trigger)
- Halaman `/app/inventory`: daftar bahan, stok current, low-stock alert
- Halaman `/app/recipes`: link menu → ingredients
- Toggle "track stock" per menu (opsional untuk minuman simple)
- Stock-in (purchase/adjustment) dengan catatan

### Fase 5 — Karyawan, Role & Absensi
Multi-user per shop dengan akses berjenjang + clock-in/out.
- Tabel `shop_members` (user_id, shop_id, role: owner/manager/cashier/barista)
- Invite karyawan via email + accept flow
- RLS update: cashier hanya akses POS+Orders, manager + Inventory, owner full
- Tabel `attendances` (clock_in, clock_out, shift_id), `shifts` (jadwal mingguan)
- Halaman `/app/staff`: kelola anggota, role
- Halaman `/app/schedule`: jadwal kerja per minggu (drag/assign)
- Halaman `/app/attendance`: tap clock-in/out di POS header, riwayat absensi

### Fase 6 — Laporan & Analitik
Owner butuh angka harian/mingguan/bulanan.
- Halaman `/app/reports`: 
  - Sales summary (hari/minggu/bulan, filter outlet)
  - Best-seller menu, sales by category
  - Sales by payment method, by cashier
  - Hourly heatmap (jam ramai)
  - Export CSV
- Dashboard `/app/index` di-upgrade: KPI cards (omzet hari ini, transaksi, AOV, top item)

### Fase 7 — Marketplace Etalase Publik
Halaman publik untuk customer order online.
- Route publik `/s/$shopSlug` (etalase) + `/s/$shopSlug/menu/$menuId`
- Cart pembeli (localStorage) + checkout flow
- Pilih mode: **Pickup** atau **Delivery**
- Auth pembeli (email + Google) terpisah dari owner
- Tabel `customer_profiles`, `customer_addresses`

### Fase 8 — Ongkir & Pengaturan Delivery
Konfigurasi ongkir per coffeeshop.
- Tabel `delivery_zones` (shop_id, name, polygon/area, fee), `delivery_settings` (mode: flat/zona, base_fee, free_above)
- Halaman `/app/delivery`: set mode flat (1 nilai) atau zona (multi area + fee)
- Auto-hitung ongkir saat customer checkout berdasar alamat
- Min order, jam operasional delivery

### Fase 9 — Order Online & Kurir Toko
Order masuk dari marketplace → dikelola di POS.
- Tabel `delivery_orders` (link ke `orders`), `couriers` (staff dengan role courier)
- Realtime notif ke owner saat order baru masuk
- Halaman `/app/online-orders`: terima/tolak, assign kurir, update status (preparing → ready → delivering → delivered)
- View kurir `/app/courier`: list order yang ditugaskan, tap "picked up", "delivered"
- Customer tracking page `/track/$orderId`

### Fase 10 — Pembayaran Online (Opsional)
Saat ini bayar di tempat. Tambahkan QRIS dinamis / payment gateway.
- Integrasi Midtrans/Xendit (atau Stripe untuk test)
- Webhook handler di edge function `/api/public/payment-webhook`
- Status order auto-update saat pembayaran sukses

### Fase 11 — Promo, Diskon & Loyalty
- Tabel `promos` (kode, jenis: %/nominal, syarat min order, expiry)
- Apply promo di POS & marketplace
- Loyalty points sederhana (1 pt per Rp X, redeem untuk diskon)

### Fase 12 — Polish & Operasional
- Settings shop: jam buka, logo, deskripsi, kontak
- Multi-outlet switcher di header (sudah ada context, perlu UI)
- PWA + offline POS (cache menu, sync order saat online)
- Notifikasi push/email untuk order baru
- Backup & export data
- Onboarding wizard yang lebih lengkap (sample data, tour)

---

## Rekomendasi Urutan Eksekusi

**Wajib MVP penuh** (sesuai PRD): Fase 4 → 5 → 6 → 7 → 8 → 9
**Nice-to-have**: Fase 10, 11, 12

Saran mulai dari **Fase 4 (Stok)** karena langsung dipakai operasional harian dan saling mengunci dengan fase 5-6. Marketplace (7-9) bisa dikerjakan paralel setelah fase 5.

## Pertanyaan Sebelum Lanjut

Mohon konfirmasi:
1. Setuju urutan di atas? Atau ada fase yang ingin diprioritaskan/diskip?
2. Mulai dari **Fase 4 (Stok & Inventori)** sekarang?
3. Tetap simple (track stock manual) atau lengkap (recipes/BOM dengan auto-decrement)?
