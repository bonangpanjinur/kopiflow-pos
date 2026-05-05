## Masalah

Build di Vercel gagal karena script `build` di root `package.json` memanggil `pnpm -r --if-present run build`, yang menjalankan **semua** workspace termasuk `artifacts/mockup-sandbox`. `mockup-sandbox/vite.config.ts` mewajibkan env `PORT` & `BASE_PATH` (untuk Replit), yang tidak ada di Vercel → build crash.

Selain itu, build seharusnya hanya menghasilkan output untuk `kopihub` (aplikasi yang dideploy), bukan semua artifact.

## Rencana Perbaikan

### 1. Ubah script `build` di root `package.json`
Dari:
```
"build": "pnpm run typecheck && pnpm -r --if-present run build"
```
Menjadi build khusus kopihub dengan env yang di-inject:
```
"build": "cd artifacts/kopihub && PORT=8080 BASE_PATH=/ npx vite build --config vite.config.ts"
```

Typecheck di-skip dari pipeline build Vercel (sudah dijalankan di CI/dev). Build mockup-sandbox & api-server tidak perlu untuk deploy frontend.

### 2. Pastikan `vercel.json` di root menunjuk output yang benar
File `vercel.json` di root sudah ada dari perubahan sebelumnya. Update agar:
- `buildCommand`: `pnpm run build` (memakai script root yang sudah diperbaiki)
- `outputDirectory`: `artifacts/kopihub/dist/public`
- `rewrites`: SPA fallback ke `/index.html`

### 3. Tidak ada perubahan ke `mockup-sandbox/vite.config.ts`
Biarkan aman — file itu untuk Replit dev sandbox, bukan target deploy.

## Hasil yang diharapkan
- `pnpm run build` di Vercel hanya membangun kopihub
- Output statis di `artifacts/kopihub/dist/public` di-serve oleh Vercel sebagai SPA
- Dev server lokal tetap jalan (script `dev` tidak diubah)

## Catatan teknis
- Env `PORT` & `BASE_PATH` di-inject inline karena `vite.config.ts` kopihub mewajibkan keduanya. Nilai 8080 & `/` aman untuk build statis.
- Script `build:dev` (yang sebelumnya tidak ada → menyebabkan error #1) sudah ditambahkan dari perbaikan sebelumnya, tetap dipertahankan.
