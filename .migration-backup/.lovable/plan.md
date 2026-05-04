# Status Implementasi

## ✅ Fase 5 selesai
- Tabel `push_subscriptions` + RLS (per-user) + index.
- `NotificationSettings` di Settings: minta izin browser, subscribe Web Push (best-effort), test bunyi/notif, unsubscribe.
- `PushNotificationManager` lama dijadikan no-op (auto-subscribe tanpa VAPID server menyebabkan kegagalan diam).
- Catatan: Push background memerlukan VAPID + worker pengirim push; saat ini notif hanya muncul saat tab terbuka (via `notify.ts`). Fitur realtime di KDS & online-orders sudah memanfaatkan ini.

## ✅ Fase 1-4 selesai
Lihat git history. POS multi-cart, RBAC staff, mobile audit, tax/service charge, notifikasi realtime in-app, export Excel, KDS realtime, stock opname, customer review, PWA stable.

## Sisa (opsional / future)
- VAPID + edge function pengirim Web Push background.
- Loyalty tier, auto-promo, payment gateway (P3 growth).
