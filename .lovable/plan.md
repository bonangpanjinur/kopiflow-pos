
# Rencana Pengembangan Lengkap — Semua Role

Berikut audit menyeluruh dari kondisi project saat ini dan rencana perbaikan/penambahan fitur.

---

## A. ROLE: OWNER (Dashboard /app)

### Sudah Ada (30+ modul)
Dashboard, POS, Orders, Online Orders, Menu (+ modifier), Kategori, Inventori, Supplier, Purchase Orders, Resep/HPP, Pegawai, Jadwal, Absensi, Delivery, Kurir, Pengantaran, Shift Kasir, Laporan, Pelanggan, Promo, Loyalty, Billing, Domain Kustom, Tampilan Toko, Backup Data, Pengaturan, Multi-Outlet.

### Perlu Diperbaiki / Ditingkatkan

1. **Dashboard (/app)** — Hanya menampilkan ringkasan hari ini. Perlu:
   - Grafik tren penjualan 7/30 hari
   - Perbandingan periode (minggu ini vs minggu lalu)
   - Widget goal/target harian

2. **POS (1500+ baris)** — File sangat besar, perlu:
   - Refactor ke komponen terpisah (cart panel, payment dialog, menu grid)
   - Keyboard shortcut (F1-F12 untuk kategori, Ctrl+P bayar)
   - Mode offline/cache menu lokal

3. **Laporan** — Ada chart dasar, perlu:
   - Export ke Excel (.xlsx), bukan hanya CSV
   - Laporan per pegawai / per shift
   - Laporan HPP vs profit margin
   - Filter per outlet

4. **Inventori** — Sudah lengkap, perlu:
   - Fitur stock opname (stock count/adjustment batch)
   - Alert reorder point otomatis (notifikasi)
   - Riwayat harga beli per ingredient

5. **Pegawai** — Perlu:
   - Role-based permission per modul (kasir hanya akses POS, manajer akses laporan)
   - Reset password oleh owner
   - Activity log per pegawai

6. **Promo** — Perlu:
   - Promo otomatis (auto-apply berdasarkan kondisi cart)
   - Promo bundle (beli A+B diskon X%)
   - Statistik penggunaan promo

7. **Loyalty** — Perlu:
   - Tier/level pelanggan (Bronze, Silver, Gold)
   - Reward catalog (tukar poin dengan item)
   - Expiry poin

8. **Online Orders** — Perlu:
   - Notifikasi realtime (push/sound) saat order masuk
   - Estimasi waktu penyiapan
   - Auto-print ke kitchen/bar

9. **Settings** — Perlu:
   - Pengaturan pajak (PPN, service charge)
   - Pengaturan struk (header, footer, logo)
   - Pengaturan jam operasional

10. **Billing** — Perlu:
    - Payment gateway integration (Midtrans/Xendit) untuk bayar plan
    - Invoice PDF download
    - Auto-renewal reminder

---

## B. ROLE: STAFF / KASIR

### Sudah Ada
Login via invitation, akses POS, shift kasir, absensi, pengantaran kurir.

### Perlu Ditambahkan

11. **Halaman Staff Dedicated** — Staff sekarang masuk ke dashboard owner penuh. Perlu:
    - Layout terpisah dengan menu terbatas sesuai permission
    - Hanya tampilkan modul yang diizinkan owner

12. **Kitchen Display System (KDS)** — Belum ada:
    - Tampilan layar dapur real-time
    - Status per item (preparing, ready)
    - Notifikasi sound saat order baru

13. **Absensi** — Perlu:
    - Clock-in/clock-out dengan foto selfie atau GPS
    - Laporan keterlambatan
    - Integrasi dengan jadwal shift

---

## C. ROLE: CUSTOMER (Storefront /s/$slug)

### Sudah Ada
Homepage toko, menu browsing, detail item + modifier, cart, checkout (pickup/delivery), login/register pelanggan, riwayat pesanan, profil, payment QRIS, order tracking.

### Perlu Diperbaiki / Ditambahkan

14. **Storefront UX** — Perlu:
    - Pencarian menu (search bar)
    - Filter berdasarkan kategori
    - Sorting (harga, populer, terbaru)

15. **Customer Account** — Perlu:
    - Halaman loyalty/poin saya
    - Daftar favorit (save item)
    - Alamat tersimpan (multi-address management)

16. **Checkout** — Perlu:
    - Estimasi ongkir real-time berdasarkan zona
    - Multiple payment method (transfer bank, e-wallet link)
    - Order scheduling (pesan untuk nanti)

17. **Review & Rating** — Belum ada:
    - Rating per menu item setelah order selesai
    - Tampilkan rata-rata rating di halaman menu

18. **Push Notification** — Belum ada:
    - Notifikasi status pesanan (dikonfirmasi, disiapkan, siap pickup, diantar)
    - Promo notification

19. **PWA Support** — Belum ada:
    - Manifest + service worker untuk install ke home screen
    - Offline fallback page

---

## D. ROLE: SUPER ADMIN (/admin)

### Sudah Ada
Dashboard, Daftar Toko, Detail Toko, Invoice, Plan management, Plan Matrix (+ concurrency, undo, audit, export), Katalog Fitur/Tema, Broadcast, Audit Log, Domain, Aktivitas, Pengaturan.

### Perlu Diperbaiki / Ditambahkan

20. **Dashboard Admin** — Perlu:
    - Grafik pertumbuhan toko/user per bulan
    - Revenue chart (MRR, churn rate)
    - Alert toko yang hampir expired

21. **Shop Detail** — Perlu:
    - Impersonate/login as owner (untuk troubleshoot)
    - Force upgrade/downgrade plan
    - Suspend/ban toko

22. **Broadcast** — Perlu:
    - Targeting (berdasarkan plan, wilayah, status)
    - Schedule broadcast
    - Template pesan

23. **Audit Log** — Perlu:
    - Filter berdasarkan user/shop/event type
    - Detail view per event (JSON payload)
    - Retention policy

---

## E. CROSS-CUTTING (Semua Role)

24. **Keamanan**
    - Review RLS policies untuk semua tabel baru
    - Rate limiting pada auth endpoints
    - Input sanitization (XSS prevention)
    - CSRF protection pada server functions

25. **Responsive / Mobile**
    - Audit semua halaman admin dan owner di mobile viewport
    - Sidebar admin belum responsive (hanya `hidden lg:flex`)
    - POS perlu mode mobile yang nyaman

26. **Error Handling**
    - Beberapa halaman tidak punya error boundary spesifik
    - Fallback UI saat Supabase unreachable
    - Loading skeleton vs spinner consistency

27. **Performance**
    - POS file 1500 baris — perlu code-splitting
    - Lazy load halaman admin
    - Image optimization (storefront logo, menu photos)

28. **Testing**
    - Belum ada unit test atau integration test
    - Minimal E2E test untuk flow kritis (signup → onboarding → POS → checkout)

---

## Prioritas Implementasi

| Prioritas | Item | Alasan |
|-----------|------|--------|
| **P0 - Kritis** | #11 Staff permission, #25 Mobile responsive, #24 Security review | Keamanan & usabilitas dasar |
| **P1 - Tinggi** | #8 Realtime order notif, #3 Laporan export, #14 Search menu, #9 Tax/receipt settings | Revenue-impacting |
| **P2 - Sedang** | #12 KDS, #2 POS refactor, #4 Stock opname, #17 Review, #16 Checkout enhancements | Operational efficiency |
| **P3 - Nice to have** | #19 PWA, #18 Push notif, #6 Auto-promo, #7 Loyalty tiers, #10 Payment gateway | Growth features |

---

Mau mulai dari prioritas mana? Atau ada fitur spesifik yang ingin didahulukan?
