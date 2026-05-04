# Deployment Guide — KopiHub

Panduan menghubungkan repo ini ke **GitHub → Vercel** dan migrasi backend ke **Supabase pribadi**.

> Status saat ini: project di-target ke Cloudflare Workers (lihat `wrangler.jsonc` & `vite.config.ts`). Untuk deploy ke Vercel, kamu perlu mengganti adapter TanStack Start. File `vercel.json` sudah disiapkan, tapi **adapter belum dimigrasi** sesuai permintaan.

---

## 1. Push ke GitHub

1. Di Lovable, buka **GitHub → Connect to GitHub** (pojok kanan atas).
2. Pilih organisasi/akun GitHub, izinkan akses, lalu **Create Repository**.
3. Selanjutnya semua perubahan di Lovable otomatis ter-push ke repo tersebut.

---

## 2. Migrasi ke Supabase Pribadi

### a. Buat Supabase project baru
1. Login ke https://supabase.com → **New Project**.
2. Catat:
   - `Project URL` → `https://xxxxx.supabase.co`
   - `anon public key`
   - `service_role key` (jangan share!)
   - `Project Ref` (`xxxxx`)

### b. Migrasikan schema
Semua migration ada di `supabase/migrations/`. Jalankan via Supabase CLI:

```bash
# Install CLI
npm i -g supabase

# Login
supabase login

# Link ke project baru
supabase link --project-ref <project-ref-baru>

# Push semua migration
supabase db push
```

### c. Buat storage buckets
Buat manual di **Supabase Dashboard → Storage**:
- `menu-images` (public)
- `shop-logos` (public)
- `payment-proofs` (private)
- `shop-backups` (private)
- `customer-exports` (private)

### d. Auth settings
Di **Authentication → Providers**, aktifkan:
- Email (default)
- Google OAuth (opsional, sesuai kebutuhan)

Aktifkan juga **Leaked Password Protection (HIBP)** di Email settings.

---

## 3. Deploy ke Vercel

### a. Import repo
1. Login ke https://vercel.com → **Add New → Project**.
2. Import repo GitHub yang baru di-push.
3. Vercel akan baca `vercel.json` otomatis.

### b. Set Environment Variables

Di **Project Settings → Environment Variables**, tambahkan:

| Key | Value | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | All |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...` (anon key) | All |
| `VITE_SUPABASE_PROJECT_ID` | `xxxxx` | All |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | All |
| `SUPABASE_PUBLISHABLE_KEY` | `eyJ...` (anon key) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role) | All |
| `LOVABLE_API_KEY` | (opsional, untuk Lovable AI Gateway) | All |

### c. ⚠️ Adapter TanStack Start (WAJIB sebelum deploy berhasil)

Project saat ini pakai adapter **Cloudflare Workers**. Untuk Vercel, ganti `vite.config.ts`:

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // tambahkan target vercel
  target: "vercel",
  vite: {
    plugins: [VitePWA({ /* ... */ })],
  },
});
```

Lalu hapus/abaikan `wrangler.jsonc`. Jalankan ulang `bun install` setelah perubahan.

> Karena kamu memilih **"hanya siapkan file konfigurasi"**, langkah ini saya tidak eksekusi. Lakukan saat siap migrate penuh.

### d. Deploy
Klik **Deploy** di Vercel. Build pertama mungkin gagal jika adapter belum diganti — itu wajar.

---

## 4. Update OAuth Redirect URLs

Setelah Vercel kasih domain (`xxx.vercel.app`):
1. Di Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://xxx.vercel.app`
   - Redirect URLs: tambahkan `https://xxx.vercel.app/**`
2. Di Google Cloud Console (jika pakai Google OAuth):
   - Authorized redirect URIs: `https://xxxxx.supabase.co/auth/v1/callback`

---

## 5. Custom Domain (opsional)
Vercel → **Settings → Domains** → tambah domain → ikuti instruksi DNS.

---

## Catatan Bug

Audit terakhir tidak menemukan runtime error atau console error. Satu warning internal `Could not resolve tailwind.config.ts` bersifat **harmless** karena project pakai Tailwind v4 (config di `src/styles.css`).

Fase 1–5 dev plan sudah complete & stabil.
