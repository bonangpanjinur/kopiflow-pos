## Audit Lengkap — Yang Belum Sempurna & Harus Dikerjakan

Setelah cek semua route, RLS, dan flow ujung-ke-ujung, ini daftar masalah yang ditemukan, diurutkan dari paling kritis.

### 🔴 Bug Kritis (data tidak tersimpan / fitur broken)

1. **Loyalty system 100% silent-fail**
   - Tabel `loyalty_points` & `loyalty_ledger` hanya punya policy SELECT. Skema mengonfirmasi: "Can't INSERT/UPDATE records".
   - Akibat: setiap kali customer/POS checkout, `applyPostOrder()` memanggil `.insert()` & `.upsert()` ke kedua tabel — selalu ditolak RLS, error di-swallow. **Tidak ada poin yang pernah benar-benar tersimpan**, balance selalu 0, redeem juga gagal mengurangi.
   - **Fix**: tambah RPC `apply_loyalty_post_order` (SECURITY DEFINER) yang melakukan upsert balance + insert ledger atomik, dan panggil dari client. Hapus path client-side direct insert.

2. **Bukti bayar QRIS tidak bisa diakses owner setelah beberapa hari**
   - Bucket `payment-proofs` private. Customer pakai `createSignedUrl(60*60*24*30)` (30 hari) — Supabase membatasi maks 7 hari, plus link bisa expired sebelum owner verifikasi.
   - Owner di online-orders cuma render `<a href={proof_url}>` tanpa re-sign.
   - **Fix**: simpan **path** (bukan signed URL) di `payment_proof_url`, dan halaman owner generate signed URL on-demand saat klik "Lihat bukti". Halaman customer juga.

3. **Label status order pelanggan inkonsistensi**
   - `s.$slug.orders` mapping pakai `voided` tapi DB enum punya `cancelled` (yang dipakai owner di online-orders). Order yang dibatalkan tidak menampilkan label/style benar.
   - **Fix**: tambahkan `cancelled` & `delivering` ke STATUS_LABEL.

### 🟡 UX / Polish penting

4. **Login redirect dari etalase rusak**
   - `s.$slug.tsx` header pakai `search={{ redirect: "" }}` → setelah login customer dilempar ke `/` (landing owner), bukan kembali ke etalase toko.
   - **Fix**: `redirect: \`/s/${slug}\``.

5. **Struk POS tidak menampilkan promo & poin**
   - Field `promo_code`, `points_earned`, `points_redeemed` sudah ada di order tapi `Receipt` component tidak render.
   - **Fix**: tambahkan baris "Promo (KODE) −Rp X" dan footer "Anda dapat N poin" jika ada.

6. **Responsive padding terlalu lebar di mobile**
   - Dashboard, Reports, dan beberapa halaman owner pakai `px-8 py-10` flat (viewport user 888px → masih oke, tapi 375px hp owner akan sumpek).
   - **Fix**: ganti ke `px-4 sm:px-6 lg:px-8 py-6 lg:py-10`.

7. **Refund / void order POS**
   - Owner tidak punya cara batalkan/refund order yang sudah completed dari halaman Orders.
   - **Fix**: tambah tombol "Batalkan / Refund" di `app.orders.tsx` detail row → set `status='voided'`, `payment_status='refunded'`, dan reverse stock movement (insert balik) bila track_stock.

8. **Customer signup confirm email**
   - Saat ini default Supabase = harus konfirmasi email. Customer marketplace banyak drop di sini.
   - **Fix**: aktifkan auto-confirm email signup (lebih friendly untuk customer beli kopi).

### 🟢 Quality-of-life

9. **Track page**: tambahkan handling `cancelled` / `delivering` step yang tepat & link "Pesan lagi" ke etalase.

10. **Etalase**: tambahkan info jam buka shop (sudah ada `open_hours` di DB) dan tampilkan "Tutup sekarang — buka jam X" badge bila di luar jam.

11. **Cleanup import unused** (Coffee, Phone, dll) — ringan.

---

## Yang Akan Dikerjakan

### Migrasi DB
- RPC `apply_loyalty_post_order(_shop_id, _user_id, _order_id, _earned, _redeemed)` SECURITY DEFINER → upsert `loyalty_points` + insert `loyalty_ledger`. Validasi: user adalah customer order ITU, atau outlet access (untuk POS).
- Auth setting: aktifkan auto-confirm email signup.

### Code
- `src/lib/promo-loyalty.ts` — ganti applyPostOrder pakai RPC baru.
- `src/routes/s.$slug.pay.$orderId.tsx` — simpan path saja, generate signed URL untuk preview.
- `src/routes/app.online-orders.tsx` — tombol "Lihat bukti" generate signed URL on-demand.
- `src/routes/s.$slug.orders.tsx` — STATUS_LABEL tambah `cancelled`, `delivering`.
- `src/routes/s.$slug.tsx` — fix login redirect.
- `src/components/pos/receipt.tsx` — tambahkan promo & poin.
- `src/routes/app.orders.tsx` — tombol Void/Refund + reverse stock.
- Dashboard & Reports & beberapa app pages — responsive padding.
- `src/routes/track.$orderId.tsx` — handle cancelled state lebih baik.
- `src/routes/s.$slug.index.tsx` — badge jam buka.
- Cleanup import unused.

### Tidak dikerjakan (sengaja)
- Marketing landing pisah (Pricing, About, dll) — di luar scope "sempurnakan", bukan bug.
- PWA / offline — fase 12 advanced, butuh diskusi tersendiri.
- Email transactional — butuh konfigurasi domain.

Setelah disetujui, saya akan implementasikan semuanya dalam satu batch.