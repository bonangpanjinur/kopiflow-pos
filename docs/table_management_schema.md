# Rancangan Skema Database untuk Manajemen Meja

Dokumen ini menguraikan perubahan dan penambahan skema database yang diperlukan untuk mengimplementasikan fitur manajemen meja (Table Management) pada KopiFlow POS (FlowPOS F&B Edition).

## 1. Tabel Baru: `tables`

Tabel `tables` akan menyimpan informasi detail mengenai setiap meja yang tersedia di sebuah outlet. Ini akan menjadi entitas dasar untuk fitur denah meja dan status meja real-time.

| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | `UUID` | Kunci utama, identifikasi unik untuk setiap meja. |
| `shop_id` | `UUID` | Kunci asing ke tabel `businesses` (atau `coffee_shops` jika belum direfaktor sepenuhnya), menunjukkan kepemilikan toko. |
| `outlet_id` | `UUID` | Kunci asing ke tabel `outlets`, menunjukkan outlet tempat meja berada. |
| `name` | `VARCHAR(255)` | Nama meja (misal: "Meja 1", "Bar Counter"). |
| `capacity` | `INTEGER` | Kapasitas tempat duduk meja. |
| `status` | `ENUM` | Status meja (`available`, `occupied`, `dirty`, `reserved`). Default: `available`. |
| `position_x` | `FLOAT` | Posisi X meja pada denah (untuk editor denah). |
| `position_y` | `FLOAT` | Posisi Y meja pada denah (untuk editor denah). |
| `width` | `FLOAT` | Lebar meja pada denah (untuk editor denah). |
| `height` | `FLOAT` | Tinggi meja pada denah (untuk editor denah). |
| `shape` | `ENUM` | Bentuk meja (`rectangle`, `circle`). Default: `rectangle`. |
| `created_at` | `TIMESTAMPTZ` | Waktu pembuatan record. |
| `updated_at` | `TIMESTAMPTZ` | Waktu terakhir record diperbarui. |

## 2. Tabel Baru: `table_maps`

Tabel `table_maps` akan menyimpan konfigurasi denah meja untuk setiap outlet, memungkinkan pemilik usaha untuk membuat dan menyimpan beberapa denah.

| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | `UUID` | Kunci utama, identifikasi unik untuk setiap denah meja. |
| `shop_id` | `UUID` | Kunci asing ke tabel `businesses` (atau `coffee_shops`), menunjukkan kepemilikan toko. |
| `outlet_id` | `UUID` | Kunci asing ke tabel `outlets`, menunjukkan outlet tempat denah berada. |
| `name` | `VARCHAR(255)` | Nama denah (misal: "Lantai 1", "Area Outdoor"). |
| `layout_data` | `JSONB` | Data JSON yang menyimpan informasi tata letak visual meja (posisi, ukuran, rotasi, dll). |
| `created_at` | `TIMESTAMPTZ` | Waktu pembuatan record. |
| `updated_at` | `TIMESTAMPTZ` | Waktu terakhir record diperbarui. |

## 3. Modifikasi Tabel yang Ada

### A. Tabel `orders`

Menambahkan kolom `table_id` untuk mengaitkan pesanan dengan meja tertentu, terutama untuk pesanan dine-in.

| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `table_id` | `UUID` | Kunci asing ke tabel `tables`, menunjukkan meja tempat pesanan dilakukan. `NULL` jika bukan pesanan dine-in. |

### B. Tabel `open_bills`

Menambahkan kolom `table_id` untuk mengaitkan tagihan yang belum dibayar dengan meja tertentu, mendukung alur `open bill` yang lebih baik.

| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `table_id` | `UUID` | Kunci asing ke tabel `tables`, menunjukkan meja yang terkait dengan tagihan terbuka. `NULL` jika tidak terkait dengan meja. |

## 4. Migrasi Database

Migrasi akan mencakup pembuatan tabel `tables` dan `table_maps`, serta penambahan kolom `table_id` pada tabel `orders` dan `open_bills`. Pastikan untuk menambahkan `FOREIGN KEY` constraints dan `INDEX` yang sesuai untuk performa.

```sql
-- Create ENUM for table_status
CREATE TYPE public.table_status AS ENUM (
  'available',
  'occupied',
  'dirty',
  'reserved'
);

-- Create ENUM for table_shape
CREATE TYPE public.table_shape AS ENUM (
  'rectangle',
  'circle'
);

-- Create tables table
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE, -- Assuming coffee_shops is still the table name for businesses
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  status public.table_status NOT NULL DEFAULT 'available',
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  width FLOAT NOT NULL DEFAULT 1,
  height FLOAT NOT NULL DEFAULT 1,
  shape public.table_shape NOT NULL DEFAULT 'rectangle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tables_shop_id ON public.tables(shop_id);
CREATE INDEX idx_tables_outlet_id ON public.tables(outlet_id);

-- Create table_maps table
CREATE TABLE public.table_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.coffee_shops(id) ON DELETE CASCADE, -- Assuming coffee_shops is still the table name for businesses
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  layout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_maps_shop_id ON public.table_maps(shop_id);
CREATE INDEX idx_table_maps_outlet_id ON public.table_maps(outlet_id);

-- Add table_id to orders table
ALTER TABLE public.orders
ADD COLUMN table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_table_id ON public.orders(table_id);

-- Add table_id to open_bills table
ALTER TABLE public.open_bills
ADD COLUMN table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL;

CREATE INDEX idx_open_bills_table_id ON public.open_bills(table_id);

-- Trigger for updated_at (assuming touch_updated_at() function exists)
CREATE TRIGGER tables_touch
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER table_maps_touch
  BEFORE UPDATE ON public.table_maps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
```
