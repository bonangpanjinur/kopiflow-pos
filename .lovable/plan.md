## Status saat ini (sudah selesai)

Berdasarkan audit codebase, ini sudah ada:

- **Super Admin area** (`/admin`) — Dashboard KPI, Toko, Tagihan (review manual transfer/QRIS), Paket, Domain, Aktivitas (cron + audit), Pengaturan (cron secret).
- **Owner tenant**: onboarding, billing manual (upload bukti), custom domain DIY, plan lifecycle otomatis.
- **POS**: open bill, split payment, struk + picker 58/80mm, shift kas.
- **Storefront** (`/s/$slug`): menu, cart, checkout, tracking, SEO (sitemap/robots/manifest).
- **Operasional**: inventory, recipe/HPP, PO, supplier, kurir, delivery zone, loyalty, promo, shift, attendance, employee+invite.
- **Observability**: cron_runs, system_audit, owner_notifications + reminder banner.
- **Security**: RLS lengkap, role super_admin terpisah, cron secret di-gate super_admin.

## Yang Anda inginkan vs realita

| Permintaan Anda | Status |
|---|---|
| 1. Super admin kelola owner | ✅ Sudah ada — perlu **sedikit penambahan**: lihat detail owner per toko, suspend/aktifkan toko, reset password owner, ubah plan manual. |
| 2. POS + print + pesan langsung jalan | ⚠️ Sudah ada — perlu **smoke test end-to-end** + perbaiki bug yang ditemukan. |
| 3. Semi-manual, tanpa payment gateway | ✅ Sudah pas — billing manual transfer + admin approve. |
| 4. Audit bug, kesiapan, optimasi kecepatan | ⏳ Belum dilakukan terstruktur. |

---

## Yang akan dikerjakan (Batch G — Production Readiness)

### G1. Super Admin: kelola owner toko (lengkapi gap)

Tambahan di `/admin/shops/$id` (halaman detail baru):
- Info owner (nama, email, last sign-in, jumlah outlet/order).
- Aksi: **Set plan manual** (free/pro + tanggal expire) tanpa lewat invoice — untuk kasus komplimen/manual.
- Aksi: **Suspend toko** (flag `suspended_at` di `coffee_shops`) → storefront tampilkan "toko ditutup sementara", owner di-redirect ke halaman billing.
- Aksi: **Kirim ulang link reset password** ke email owner (via `supabase.auth.admin.generateLink`).
- Aksi: **Hapus toko** (soft-delete, hanya super admin, dengan konfirmasi ketik nama).
- Tab "Audit toko" — gabung `system_audit` + `domain_audit` + `branding_audit` yang relevan dengan shop tsb.

Migrasi DB:
- `alter table coffee_shops add column suspended_at timestamptz, suspended_reason text;`
- RLS policy update + middleware di `app.tsx` untuk redirect ke `/app/billing` saat suspended.
- Storefront cek `suspended_at` → 503 page.

### G2. Smoke test fitur inti + perbaikan bug yang ditemukan

Saya akan menjalankan dan men-trace flow ini end-to-end (lihat console, network, DB):

1. **Signup owner → onboarding → buat outlet & menu** — pastikan trigger `coffee_shops` + role + outlet auto-create benar.
2. **POS**: tambah item → bayar tunai → cetak struk 58mm & 80mm → cek `orders` + `cash_movements` + stok (jika ada recipe) ter-deduct.
3. **POS split payment** (cash + QRIS) → pastikan masuk dua entry & total cocok.
4. **Open bill park & resume** — pastikan tidak ghost-double saat resume cepat.
5. **Storefront customer**: pesan dari `/s/$slug` → checkout → owner terima di `/app/online-orders` → update status → customer lihat di `/track/$id`.
6. **Print integration**: validasi CSS `@page` 58/80mm di Chrome (browser print) — bukti screenshot.
7. **Reminder & cron**: trigger `runPlanMaintenance` manual → cek `cron_runs` + notifikasi muncul.
8. **Domain custom**: request → DNS instruksi → verifikasi (mock TXT) → auto-unverify saat hilang.

Setiap bug yang ditemukan saya perbaiki dalam batch yang sama dengan catatan jelas (file + line).

### G3. Audit kesiapan & keamanan

- Jalankan **security scan** otomatis (RLS gap, policy permisif, kolom sensitif).
- Cek **N+1 query** di hot path: `app.pos.tsx`, `app.online-orders.tsx`, `s.$slug.menu.tsx`, dashboard owner.
- Pastikan tidak ada `select *` ke tabel besar tanpa limit.
- Cek **bundle size** route besar (POS ~1467 baris) — kandidat code-split.
- Validasi semua server functions punya `assertSuperAdmin` / RLS yang benar.

### G4. Optimasi kecepatan

- **Index DB**: tambah index untuk query yang sering dipakai (orders by shop+created_at, menu_items by shop+is_available, online-orders by status).
- **Query batching**: gabungkan multi `Promise.all` di `admin.index.tsx` jadi satu RPC `admin_dashboard_stats()`.
- **Lazy-load POS modal** (Receipt + Promo dialog) → kurangi initial bundle.
- **Image lazy + width/height** di storefront menu list (CLS turun).
- **Storefront cache**: tambah `Cache-Control: public, max-age=60, s-maxage=300` di route loader storefront publik.
- **React Query / loader caching** untuk data shop yang dipanggil berulang (`useCurrentShop` saat ini fetch tiap mount).
- **Realtime subscription cleanup** — pastikan unsubscribe saat unmount (cek di online-orders & track page).

### G5. Hasil akhir

- Laporan ringkas (markdown di chat) berisi: bug yang diperbaiki, hasil security scan, daftar query dengan latency sebelum/sesudah, ukuran bundle sebelum/sesudah.
- Checklist kesiapan produksi: ✅ auth, ✅ RLS, ✅ backup (managed Cloud), ✅ cron, ✅ observability, ⚠️ payment (sengaja manual), dst.

---

## Detail teknis singkat

```text
Migrasi: 1 file
  - add coffee_shops.suspended_at, suspended_reason
  - index orders(shop_id, created_at desc)
  - index menu_items(shop_id, is_available)
  - index online_orders status partial
  - rpc admin_dashboard_stats() returns json
  - rpc admin_set_shop_plan(shop_id, plan, expires_at)
  - rpc admin_suspend_shop(shop_id, reason)

Server functions baru:
  - src/server/admin-shops.functions.ts
    -> getShopDetail, setShopPlanManual, suspendShop, unsuspendShop,
       sendPasswordResetToOwner, softDeleteShop

Routes baru:
  - src/routes/admin.shops.$id.tsx (detail + aksi)

Edits:
  - src/routes/admin.shops.tsx (link ke detail + badge "Suspended")
  - src/routes/app.tsx (redirect bila shop.suspended_at)
  - src/routes/s.$slug.tsx (banner "tutup sementara")
  - src/routes/admin.index.tsx (pakai RPC tunggal)
  - src/routes/app.pos.tsx (lazy import dialog berat)
  - src/routes/s.$slug.index.tsx (loading=lazy + cache header)
```

## Yang TIDAK termasuk batch ini (sesuai permintaan Anda)

- Payment gateway otomatis (Midtrans/Xendit) — ditunda.
- Email/WhatsApp notification otomatis — ditunda.
- Analytics chart owner — ditunda.

---

Setelah Anda approve, saya akan:
1. Buat migrasi G1.
2. Buat halaman detail toko + server functions super-admin.
3. Jalankan smoke test (saya report bug yang muncul, lalu fix).
4. Apply optimasi G4.
5. Kirim laporan akhir di chat.

Mau lanjut dengan rencana ini, atau ada yang ingin ditambah/dipangkas (mis. skip soft-delete, skip suspend, dll)?