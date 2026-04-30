import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMyNotifications, markNotification, dismissAllNotifications } from "@/server/notifications.functions";
import { toast } from "sonner";

type Notif = {
  id: string;
  shop_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  danger: "bg-red-50 border-red-200 text-red-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
};

export function OwnerReminderBanner() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const rows = await listMyNotifications();
      setItems(rows as Notif[]);
    } catch {
      // ignore — likely not signed in yet
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const dismissOne = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await markNotification({ data: { id, action: "dismiss" } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
      load();
    }
  };

  const dismissAll = async () => {
    setItems([]);
    try {
      await dismissAllNotifications();
      toast.success("Semua notifikasi ditutup");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
      load();
    }
  };

  if (items.length === 0) return null;

  const top = items.slice(0, open ? items.length : 1);

  return (
    <div className="space-y-2 px-3 py-2 lg:px-4">
      {top.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info}`}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{n.title}</div>
            {n.body && <div className="opacity-80">{n.body}</div>}
            {n.link && (
              <Link to={n.link} className="mt-1 inline-block underline font-medium">
                Buka
              </Link>
            )}
          </div>
          <button
            onClick={() => dismissOne(n.id)}
            className="opacity-70 hover:opacity-100"
            aria-label="Tutup"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {items.length > 1 && (
        <div className="flex items-center justify-between text-xs">
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setOpen((v) => !v)}>
            <Bell className="h-3.5 w-3.5" />
            {open ? "Sembunyikan" : `Lihat ${items.length - 1} lainnya`}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={dismissAll}>
            <Check className="h-3.5 w-3.5" /> Tutup semua
          </Button>
        </div>
      )}
    </div>
  );
}
