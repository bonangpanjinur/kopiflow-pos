## Ringkasan

Empat peningkatan untuk Inventory Pro:
1. **Halaman detail PO** sebagai route tersendiri (bukan dialog) dengan aksi Receive
2. **Stock Opname** versi multi-item (bulk) dengan validasi & log
3. **HPP & margin real-time** di halaman Recipes dan Menu
4. **Dialog Low-Stock** dengan rekomendasi supplier + tombol "Buat PO dari template"

---

## 1. Halaman Detail Purchase Order

**File baru**: `src/routes/app.purchase-orders.$poId.tsx`

Konten:
- Header: No PO, status badge, tanggal order/expected/received, supplier (link ke `/app/suppliers`)
- Tabel item: bahan, qty, satuan, harga/unit, subtotal, **received_qty** (tampilkan saat status `received`)
- Ringkasan: subtotal, tax, total
- Catatan PO
- Tombol aksi (kondisional status):
  - `draft` → **Order ke supplier** (status → `ordered`), **Batal**, **Hapus**
  - `ordered` → **Terima & update stok** (panggil RPC `receive_purchase_order`), **Batal**
  - `received` → tampilkan ringkasan stok update (read-only) + tombol **Cetak**
  - `cancelled` → read-only

Aksi Receive memanggil RPC yang sudah ada (`receive_purchase_order`) yang otomatis: insert stock_movements (purchase) → trigger naikkan stok → update HPP weighted average.

**Update di** `src/routes/app.purchase-orders.tsx`:
- Hapus dialog detail; ubah `onClick` row tabel jadi `<Link to="/app/purchase-orders/$poId">`
- Tambah kolom "Item" (jumlah baris) di list

---

## 2. Stock Opname (versi lengkap)

**Update** `src/routes/app.inventory.tsx`:

Tambah tombol header **"Opname Massal"** yang membuka dialog full-width:
- Tabel semua bahan aktif: nama, satuan, **stok sistem** (read-only), input **stok aktual** (number, min 0), kolom **selisih** (auto, badge merah/hijau), input **catatan/baris**
- Filter: search nama, opsi "tampilkan hanya yang berubah"
- Validasi: aktual harus angka ≥ 0; tolak NaN; abaikan baris tanpa perubahan
- Tombol **Simpan Opname** → loop insert `stock_movements`:
  - Selisih positif → type=`adjustment` (qty=delta)
  - Selisih negatif → type=`waste` (qty=|delta|)
  - Note format: `Opname [tanggal]: sistem X → aktual Y` + catatan user
- Tampilkan ringkasan hasil: jumlah item disesuaikan, total nilai selisih (qty × cost_per_unit) dalam IDR
- Toast sukses + reload

Opname per-item yang sudah ada (tombol per row) tetap dipertahankan untuk koreksi cepat.

---

## 3. HPP & Margin Real-time

View `menu_hpp_view` sudah ada (kolom: hpp, margin, margin_percent, price). Tambahkan kolom **last_updated** dengan migration baru:

```sql
DROP VIEW IF EXISTS public.menu_hpp_view;
CREATE VIEW public.menu_hpp_view WITH (security_invoker=true) AS
SELECT 
  m.id AS menu_item_id, m.shop_id, m.name, m.price,
  COALESCE(SUM(r.quantity * i.cost_per_unit), 0) AS hpp,
  m.price - COALESCE(SUM(r.quantity * i.cost_per_unit), 0) AS margin,
  CASE WHEN m.price > 0 
    THEN ROUND(((m.price - COALESCE(SUM(r.quantity * i.cost_per_unit),0)) / m.price * 100)::numeric, 2)
    ELSE 0 END AS margin_percent,
  GREATEST(m.updated_at, COALESCE(MAX(i.updated_at), m.updated_at)) AS last_updated,
  COUNT(r.id) AS recipe_count
FROM menu_items m
LEFT JOIN recipes r ON r.menu_item_id = m.id
LEFT JOIN ingredients i ON i.id = r.ingredient_id
GROUP BY m.id;
```

**Update** `src/routes/app.recipes.tsx`:
- Ambil `menu_hpp_view` paralel dengan menus
- Di sidebar menu list: tampilkan margin% kecil (warna hijau >30%, kuning 10-30%, merah <10%)
- Di panel detail menu: card "HPP & Margin" dengan:
  - HPP (IDR), Harga jual (IDR), Margin (IDR), Margin% (badge berwarna)
  - "Sumber: N bahan dari resep" + tombol "Lihat breakdown" yang expand list bahan dengan `qty × cost_per_unit = subtotal` per baris
  - "Terakhir diperbarui: [relative time]"

**Update** `src/routes/app.menu.tsx`:
- Tambah kolom **HPP** dan **Margin%** di tabel menu
- Indicator visual: dot warna sesuai margin level
- Empty state HPP jika belum ada resep ("Atur resep →")

---

## 4. Dialog Low-Stock dari Widget Dashboard

**File baru**: `src/components/inventory/low-stock-dialog.tsx`

Komponen dialog reusable yang menerima `shopId` dan menampilkan:
- Tabel ingredient low-stock: nama, stok sekarang, min, **kekurangan** (min - current), satuan, supplier rekomendasi
- Logika rekomendasi supplier: ambil supplier terakhir yang pernah supply ingredient itu via `purchase_order_items` join `purchase_orders` (urut `created_at` desc, ambil yang `status='received'`); fallback "Belum ada riwayat"
- Group by supplier: kelompokkan ingredient per supplier yang sama
- Tombol **"Buat PO untuk supplier ini"** per group:
  - Insert `purchase_orders` (status=`draft`, po_no auto-generate, supplier_id, shop_id)
  - Insert `purchase_order_items` untuk tiap ingredient dengan `quantity = max(min_stock × 2 − current_stock, min_stock)`, `unit_cost = ingredient.cost_per_unit`
  - Hitung subtotal/total
  - Redirect ke `/app/purchase-orders/$poId` (halaman detail baru) untuk review/edit sebelum order
- Tombol "Buka Inventori" untuk manual handling

**Update** `src/routes/app.index.tsx`:
- Ubah widget low-stock di dashboard: tambah tombol **"Lihat & Pesan"** di samping "Kelola →" yang membuka `LowStockDialog`

**Update** `src/routes/app.inventory.tsx`:
- Tombol kecil di banner low-stock untuk juga membuka dialog yang sama

---

## File Changes

**Baru:**
- `src/routes/app.purchase-orders.$poId.tsx` (route detail PO)
- `src/components/inventory/low-stock-dialog.tsx`
- `supabase/migrations/<ts>_menu_hpp_view_v2.sql` (recreate view dengan last_updated & recipe_count)

**Diedit:**
- `src/routes/app.purchase-orders.tsx` (hapus dialog detail, link ke route baru, kolom item count)
- `src/routes/app.inventory.tsx` (opname massal dialog, low-stock dialog trigger)
- `src/routes/app.recipes.tsx` (HPP card, margin badge, breakdown)
- `src/routes/app.menu.tsx` (kolom HPP & margin)
- `src/routes/app.index.tsx` (trigger low-stock dialog)

Migrasi hanya recreate view (aman, view tidak menyimpan data).
