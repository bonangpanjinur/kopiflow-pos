import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ensureNotificationPermission, notifyOrder } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function NotificationSettings({ shopId }: { shopId?: string | null }) {
  const { user } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "Notification" in window;
    setSupported(ok);
    if (ok) setPerm(Notification.permission);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.pushManager.getSubscription().then((s) => setSubscribed(!!s));
      });
    }
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const p = await ensureNotificationPermission();
      setPerm(p);
      if (p !== "granted") {
        toast.error("Izin notifikasi ditolak. Aktifkan di pengaturan browser.");
        return;
      }

      // Try to subscribe via Push API (best-effort, requires SW + VAPID at server)
      if ("serviceWorker" in navigator && "PushManager" in window && user) {
        try {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true });
          }
          if (sub) {
            const json = sub.toJSON();
            await supabase.from("push_subscriptions").upsert(
              {
                user_id: user.id,
                endpoint: sub.endpoint,
                subscription: json as never,
                user_agent: navigator.userAgent,
                shop_id: shopId ?? null,
              },
              { onConflict: "user_id,endpoint" },
            );
            setSubscribed(true);
          }
        } catch (e) {
          // VAPID not configured / unsupported — fallback to local only
          console.warn("Push subscribe skipped:", e);
        }
      }

      notifyOrder("FlowPOS", "Notifikasi berhasil diaktifkan ✓");
      toast.success("Notifikasi diaktifkan");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          if (user) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("user_id", user.id)
              .eq("endpoint", sub.endpoint);
          }
        }
      }
      setSubscribed(false);
      toast.success("Berhenti berlangganan notifikasi");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Browser Anda tidak mendukung notifikasi.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-muted-foreground">
        Status izin: <span className="font-medium text-foreground">{perm}</span>
        {subscribed && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">Berlangganan</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {perm !== "granted" || !subscribed ? (
          <Button size="sm" onClick={enable} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            Aktifkan notifikasi
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={disable} disabled={busy}>
            <BellOff className="mr-2 h-4 w-4" /> Matikan
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => notifyOrder("Tes", "Ini contoh notifikasi pesanan masuk")}>
          Tes bunyi & notif
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Notifikasi muncul saat tab aplikasi terbuka. Push notification background memerlukan konfigurasi VAPID di server.
      </p>
    </div>
  );
}
