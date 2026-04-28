## Audit Hasil: Apa yang Sudah Ada vs Belum

Sistem KopiHub sudah punya pondasi sangat lengkap (POS, multi-cart, online order, kurir, loyalty, promo, QRIS manual, tracking). Tapi banyak **fitur kunci di sisi pembeli & POS** masih kasar atau missing. Ini daftar yang akan disempurnakan.

### A. POS — yang masih kurang (untuk owner/kasir)

1. **Tidak ada modifier / catatan per item saat tambah ke cart** — kasir tidak bisa input "less sugar / extra shot" tanpa hack.
2. **Tidak ada split bill / multi-payment** — order >100rb sering dibayar gabungan cash+QRIS.
3. **Tidak ada quick-discount** (potongan manual Rp/% per order) selain promo code.
4. **Tidak ada hold & recall + nomor meja** — open bill ada tapi label generic.
5. **Reprint struk dari Order list** belum ada (struk hanya muncul saat checkout).
6. **Shortcut keyboard** (Enter=bayar, F2=cash, F3=qris) — POS desktop production butuh ini.
7. **Search menu by SKU / barcode** (opsional, tapi penting untuk inventory-heavy).
8. **Daily cash drawer / shift open-close + setoran kas** — tidak ada.

### B. Pesan online — sisi pembeli (PALING PENTING)

1. **Etalase tidak menampilkan info toko**: jam buka, status open/closed badge, alamat, telepon, link WA. Saat ini hanya nama + deskripsi.
2. **Address book**: tabel `customer_addresses` sudah ada tapi **tidak dipakai** — customer harus ketik alamat manual setiap order.
3. **Saved profile**: nama & HP tidak auto-fill dari `customer_profiles`.
4. **Riwayat pesanan tipis**: `s.$slug.orders` tidak menampilkan rincian item, tidak ada tombol "Pesan lagi" (re-order ke cart).
5. **Track order inkonsisten**: tombol "Lacak" di orders → buka `/track/$id` tapi etalase tidak punya CTA setelah checkout. Customer suka bingung.
6. **Estimasi waktu** (ETA pickup/delivery) tidak ada — owner & customer butuh.
7. **Realtime status update** untuk customer di halaman orders: tidak subscribe.
8. **Cart kosong UX**: tidak ada empty state nice + suggestion menu.
9. **Tidak ada filter "Tersedia saja"** & **out-of-stock indicator** di etalase.
10. **Login/signup flow** customer di etalase hanya email+password, tidak ada Google. Friction tinggi.
11. **Halaman checkout**: tidak ada "Estimasi tiba" preview, tidak ada validasi nomor HP Indonesia, alamat textarea polos (bisa kasih chip "rumah/kantor").
12. **Notifikasi customer**: setelah owner update status, tidak ada toast/notif visual selain refresh manual di halaman orders.

### C. Kurir — sisi kurir & owner

1. **Halaman kurir** (`app/courier`) hanya list order ditugaskan; **tidak ada peta / link Google Maps** untuk navigasi ke alamat customer.
2. **Tidak ada tombol "Mulai antar / Sudah sampai"** dari sisi kurir (hanya owner yang ubah status).
3. **Kurir tidak bisa mark "tidak ditemukan / customer tidak respon"** (status exception).
4. **Owner di list kurir**: tidak ada statistik per kurir (jumlah antar hari ini, on-time).

### D. Backend / data integrity yang masih bocor

1. **`customer_profiles` belum auto-create** saat customer signup di etalase (mirip `profiles` trigger tapi untuk customer).
2. **Nomor HP customer tersimpan acak**: kadang di `orders.customer_phone`, tidak pernah di `customer_profiles`.
3. **`promo_redemptions` belum di-insert** dari client checkout (harusnya `INSERT` setelah order confirmed). Sekarang hanya `usage_count` yang naik via RPC.
4. **`payment-proofs` storage policy** belum diverifikasi — customer harus bisa upload, owner read. Perlu RLS storage policy eksplisit.

### E. UX & polish yang masih outstanding

1. Landing page (`/`) masih demo "Mulai gratis" tanpa harga, fitur, kontak.
2. Halaman owner pakai padding `p-6` flat — tidak responsive optimal di mobile (`px-4 sm:px-6 lg:px-8 py-6 lg:py-10`).
3. Tidak ada PWA manifest / install prompt untuk customer agar etalase terasa "app".

---

## Rencana Implementasi (3 batch besar, semua dikerjakan)

### Batch 1 — Sisi Pembeli: pengalaman online order kelas atas

**Migrasi DB**:
- Trigger `handle_new_customer_signup`: auto-insert `customer_profiles` row saat user signup dari etalase (deteksi via `raw_user_meta_data->>'is_customer'='true'` flag yang dipasang oleh `s.$slug.signup`).
- Storage RLS untuk bucket `payment-proofs`:
  - INSERT: customer pemilik order (path = `{order_id}/...`).
  - SELECT: owner shop dari order tsb + customer pemilik order.

**Etalase (`s.$slug.index.tsx`)**:
- Hero card: logo besar, nama, tagline, badge **Buka/Tutup** real-time (pakai `open_hours` jsonb), alamat, tombol WhatsApp, share.
- Item card: badge "Habis" untuk yang `is_available=false` (sekalian ditampilkan grayed), filter "Sembunyikan habis".
- Sticky kategori bar saat scroll.

**Cart (`s.$slug.cart.tsx`) & detail menu**:
- Modifier note per item (textarea saat klik item) — sudah ada field `note` di cart, tinggal UI.
- Empty state dengan CTA "Lihat menu".

**Checkout (`s.$slug.checkout.tsx`)**:
- **Address book**: dropdown alamat tersimpan + tombol "Simpan sebagai alamat baru" (`Rumah/Kantor/Lainnya` chip). Auto-fill `customer_profiles` (nama+HP) saat mount.
- Validasi nomor HP Indonesia (regex `^08[0-9]{8,12}$` atau `^\+62`).
- ETA preview: "Estimasi siap ~20 menit" (config field per shop, default 20).
- Setelah submit: redirect ke `/track/$orderId` (bukan `/s/$slug/orders`).

**Riwayat (`s.$slug.orders.tsx`)**:
- Expand/collapse rincian item.
- Tombol **"Pesan lagi"** → load item ke cart current shop (skip yang sudah dihapus).
- Realtime subscribe: status berubah → toast.

**Login/Signup customer (`s.$slug.login.tsx`, `s.$slug.signup.tsx`)**:
- Tambah tombol Google OAuth (dengan `redirectTo` kembali ke storefront).
- Set metadata `is_customer: true` saat signup dari sini.

### Batch 2 — POS Pro & Kurir Tooling

**POS (`app.pos.tsx`)**:
- Klik item → buka mini sheet "Tambah item" dengan input qty + textarea catatan (modifier).
- Tombol "Diskon manual" di footer cart (Rp atau %). Disimpan ke `orders.discount` + label note.
- **Split payment dialog**: dua input (cash + qris), validasi total = grand. Simpan via field `payment_method='split'` (perlu enum baru) ATAU simpan combined string di `note` + tetap pakai method dominan.  
  → Pilih simple: tetap satu method utama tapi tambah field `note` "Split: Cash 50rb + QRIS 30rb".
- **Reprint** dari `app/orders.tsx` → buka dialog `Receipt` lagi.
- Shortcut keyboard di POS (Enter, F2/F3, Esc).
- Search menu: tambah filter "kategori chip" sticky.

**Kurir (`app/courier.tsx`)**:
- Tombol "Buka di Maps" per order (`https://maps.google.com/?q=${encodeURIComponent(address)}`).
- Tombol "Mulai antar" (`status='delivering'`) & "Selesai" (`status='completed'`) dari sisi kurir (RLS sudah mengizinkan via `orders_courier_update`).
- Tombol "Hubungi" → `tel:` + WhatsApp.
- Stats card di top: "Hari ini: 5 antar / 3 selesai".

**Owner kurir list (`app.couriers.tsx`)**:
- Kolom statistik 7 hari terakhir per kurir (jumlah antar, total ongkir).

### Batch 3 — Polish & Foundation

- Landing `/` direvamp: section Fitur, Harga (opsional), Testimonial, CTA, footer.
- Semua halaman owner: ganti `p-6` → `px-4 sm:px-6 lg:px-8 py-6`.
- Tambah `manifest.webmanifest` + apple-touch-icon untuk PWA basic (install prompt di Chrome Android).
- Per-shop "Estimasi siap" field di `app.settings` → simpan di `coffee_shops.prep_minutes` (kolom baru integer default 20).
- Insert `promo_redemptions` row dari client setelah order create (RLS sudah mengizinkan).

---

## Yang **TIDAK** dikerjakan (sengaja, biar focused)

- Payment gateway otomatis (Midtrans/Xendit) — tetap QRIS manual.
- Email transactional — butuh konfigurasi domain.
- Multi-bahasa, dark mode, push notification ke customer (web push butuh service worker setup serius).
- Voucher digital / referral / membership tier.

Setelah disetujui, saya implementasikan **ketiga batch dalam satu jalur** (DB migrations dulu, lalu code per area). Estimasi 1 sesi panjang.
