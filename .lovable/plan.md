## Analisis Error & Status Implementasi

### 🔴 Error Aktif (Blocking — preview crash)

**1. PWAUpdater crash (SSR 500 error)** — Halaman tidak bisa dirender
- File: `src/components/PWAUpdater.tsx:8`
- Error: `Cannot destructure property 'Symbol(Symbol.iterator)' of useRegisterSW(...) as it is undefined`
- Penyebab:
  - Hook `useRegisterSW` dari `virtual:pwa-register/react` dipanggil saat SSR di Cloudflare Worker, padahal hook ini hanya valid di browser.
  - Properti `needUpdate` salah — yang benar `needRefresh` (API `vite-plugin-pwa`).
- Dampak: Komponen dipasang di `__root.tsx` line 133 → semua route gagal SSR.

**2. POS broken — tipe `CartItem` tidak konsisten** (TypeScript hard error)
- `src/lib/cart.ts` mendefinisikan `CartItem` dengan field `menu_item_id`, `unit_price`, `options: SelectedOption[]` (required), dan `cartItemKey` menerima 1 argumen object.
- `src/routes/app.pos.tsx` memakai field lama `id`, `price`, dan memanggil `cartItemKey(it.id, options)` (2 argumen).
- `CartPanel.tsx` memakai `lineUnitPrice(it) * it.quantity` (oke) tapi POS push object `{ id, price, ... }` yang tidak match interface.
- Dampak: type error + runtime mismatch (subtotal NaN, dedup tidak bekerja).

**3. tailwind.config.ts tidak ditemukan** (warning, non-blocking)
- Project pakai Tailwind v4 via `src/styles.css`, tapi tooling internal masih cari `tailwind.config.ts`. Aman diabaikan kecuali muncul lagi sebagai blocker.

---

### 🟡 Yang Belum Selesai (dari plan P0–P3)

**Sudah selesai sebagian:**
- ✅ Staff RBAC (table + hook + filter sidebar)
- ✅ Admin sidebar mobile (Sheet)
- ✅ Dashboard analytics 7/30 hari
- ✅ Receipt header/footer
- ✅ Plan Matrix advanced (concurrency, undo, audit, export)

**Belum tersentuh / setengah jadi:**
| # | Item | Status |
|---|------|--------|
| P0 | Security/RLS audit menyeluruh untuk tabel baru (`staff_permissions`, audit logs) | belum |
| P0 | Mobile audit untuk halaman owner (POS, Reports, Inventori) | belum |
| P1 | Notifikasi realtime order masuk (sound + toast) | belum |
| P1 | Export laporan ke Excel (.xlsx) | belum (masih CSV) |
| P1 | Tax/PPN & service charge settings | belum |
| P2 | KDS (`app.kds.tsx` ada di routes tapi perlu verifikasi konten realtime) | perlu cek |
| P2 | Refactor POS — komponen baru ada (`MenuGrid`, `CartPanel`, `PaymentDialog`) tapi **integrasi rusak** karena tipe `CartItem` mismatch | rusak |
| P2 | Stock opname | belum |
| P2 | Customer review/rating | belum |
| P3 | PWA — sudah dipasang tapi **crash** | rusak |
| P3 | Push notification (`PushNotificationManager.tsx` ada, perlu verifikasi) | perlu cek |

---

## Rencana Perbaikan (Urutan Eksekusi)

### Fase 1 — Hentikan Pendarahan (BLOCKER, harus dulu)

**1.1 Perbaiki `PWAUpdater.tsx`**
- Ganti `needUpdate` → `needRefresh` (sesuai API `vite-plugin-pwa`).
- Bungkus `useRegisterSW` agar hanya jalan di client: lazy-load dengan `useEffect` + dynamic import, atau render `null` saat SSR (`if (typeof window === 'undefined') return null` sebelum hook — tidak boleh, hook harus konsisten; gunakan client-only wrapper via `useState(false)` + `useEffect` set true, dan render hook hanya saat mounted).
- Pola yang dipakai: komponen `PWAUpdaterInner` yang berisi hook, dirender dari `PWAUpdater` hanya setelah `mounted = true`.

**1.2 Selaraskan `CartItem` di POS**
- Pilih satu sumber kebenaran: ikuti `src/lib/cart.ts` (`menu_item_id`, `unit_price`, `options` required, `note` optional).
- Update `src/routes/app.pos.tsx`:
  - `addToCart`: push `{ menu_item_id: it.id, name, unit_price: it.price, quantity: 1, options: options ?? [], note: "" }`.
  - `cartItemKey(...)` panggilan ganti ke object signature: `cartItemKey({ menu_item_id, options })`.
  - `handleCheckout`: gunakan `lineUnitPrice(it)` untuk `unit_price` dan `subtotal` order_items, dan map `it.menu_item_id`.
- Verifikasi `CartPanel.tsx` (sudah pakai `menu_item_id` & `lineUnitPrice` dengan benar — no change needed).

**1.3 Verifikasi build hijau**
- Setelah 1.1 & 1.2, cek dev-server log bersih dan halaman `/` render.

### Fase 2 — Lengkapi P0 (Keamanan & Mobile)

**2.1 RLS audit**
- Jalankan `supabase--linter` + review manual policy untuk: `staff_permissions`, `system_audit`, `plan_matrix_*`.
- Pastikan staff hanya bisa SELECT permission dirinya sendiri; super admin saja yang INSERT/UPDATE.

**2.2 Mobile audit halaman owner**
- POS: enable cart sebagai Sheet drawer di < md viewport (saat ini `hidden md:block` → cart hilang di mobile).
- Reports & Inventori: cek tabel scroll horizontal, tombol aksi tetap reachable.

### Fase 3 — P1 Tinggi (Revenue impact)

**3.1 Notifikasi realtime order masuk** — Subscribe `postgres_changes` di `app.online-orders.tsx` + sound (HTML5 Audio) + toast.
**3.2 Export Excel** — Tambah util `exportXLSX` pakai library ringan (`xlsx` atau buat sendiri via SheetJS-lite); pasang di `app.reports.tsx`.
**3.3 Tax/Service charge settings** — Migration kolom `tax_percent`, `service_charge_percent` di `coffee_shops`; UI di `app.settings.tsx`; terapkan di POS checkout & receipt.

### Fase 4 — P2 (Operasional)

**4.1 Cek isi `app.kds.tsx`** dulu, lalu lengkapi realtime + sound jika kosong.
**4.2 Stock opname** — Halaman baru `app.stock-opname.tsx` + table `stock_count_sessions`.
**4.3 Customer review** — Table `menu_reviews` + UI rating di order history customer + agregat di menu detail.

### Fase 5 — P3 (Growth)

**5.1 Verifikasi `PushNotificationManager`** dan integrasi Web Push.
**5.2 Loyalty tier, auto-promo, payment gateway** — sesuai plan.

---

## Catatan Teknis

- Hook `useRegisterSW` MUST hanya dipanggil di client. Pola aman:
  ```tsx
  export function PWAUpdater() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return <PWAUpdaterInner />;
  }
  ```
- API `vite-plugin-pwa` (sesuai `virtual:pwa-register/react`):
  - `offlineReady: [boolean, setter]`
  - `needRefresh: [boolean, setter]` ← **bukan** `needUpdate`
  - `updateServiceWorker(reloadPage?)`
- `cartItemKey` di `src/lib/cart.ts` menerima 1 argumen object, bukan 2 argumen positional.

## Yang Akan Dieksekusi Setelah Approval

Fokus pertama hanya **Fase 1 (1.1 + 1.2 + 1.3)** — itu yang paling kritis karena saat ini preview blank/error. Setelah konfirmasi preview hijau, lanjut Fase 2 dst sesuai prioritas.

Mau saya langsung kerjakan **Fase 1 saja** dulu, atau **Fase 1 + Fase 2** sekaligus?