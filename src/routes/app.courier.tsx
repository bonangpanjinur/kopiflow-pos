import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Bike, Loader2, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/courier")({
  component: CourierView,
});

type Order = {
  id: string;
  order_no: string;
  status: string;
  total: number;
  delivery_fee: number;
  delivery_address: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  ready: "Siap diambil",
  delivering: "Sedang diantar",
  completed: "Terkirim",
};

function CourierView() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [courierIds, setCourierIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data: cs } = await supabase
        .from("couriers")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true);
      const ids = (cs ?? []).map((c) => c.id);
      if (cancelled) return;
      setCourierIds(ids);
      if (ids.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("orders")
        .select(
          "id,order_no,status,total,delivery_fee,delivery_address,customer_name,customer_phone,note,created_at"
        )
        .in("courier_id", ids)
        .in("status", ["ready", "delivering", "completed"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setOrders((data ?? []) as Order[]);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`courier-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const update = async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as "delivering" | "completed" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Status diperbarui");
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Masuk dulu untuk melihat tugas.</p>
        <Link to="/login">
          <Button>Masuk</Button>
        </Link>
      </div>
    );
  }

  if (courierIds.length === 0) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <Bike className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Akun Anda belum terdaftar sebagai kurir aktif. Hubungi pemilik toko.
        </p>
      </div>
    );
  }

  const active = orders.filter((o) => ["ready", "delivering"].includes(o.status));
  const done = orders.filter((o) => o.status === "completed");
  const todayStr = new Date().toDateString();
  const doneToday = done.filter((o) => new Date(o.created_at).toDateString() === todayStr);
  const activeCount = active.length;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Bike className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Pengantaran</h1>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Aktif</div>
          <div className="text-xl font-bold">{activeCount}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Selesai hari ini</div>
          <div className="text-xl font-bold">{doneToday.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Pendapatan ongkir</div>
          <div className="text-sm font-bold">
            {formatIDR(doneToday.reduce((s, o) => s + Number(o.delivery_fee || 0), 0))}
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Aktif</h2>
      {active.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada tugas pengantaran.
        </p>
      ) : (
        <div className="mb-6 space-y-3">
          {active.map((o) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">#{o.order_no}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                  {STATUS_LABEL[o.status]}
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-sm">
                {o.customer_name && <p>👤 {o.customer_name}</p>}
                {o.customer_phone && (
                  <a
                    href={`tel:${o.customer_phone}`}
                    className="flex items-center gap-1.5 text-primary"
                  >
                    <Phone className="h-3.5 w-3.5" /> {o.customer_phone}
                  </a>
                )}
                {o.delivery_address && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p>{o.delivery_address}</p>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(o.delivery_address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Buka di Google Maps →
                      </a>
                    </div>
                  </div>
                )}
                {o.note && <p className="text-muted-foreground">📝 {o.note}</p>}
                <p className="mt-1 font-semibold">{formatIDR(Number(o.total))}</p>
              </div>
              <div className="mt-3 flex gap-2">
                {o.status === "ready" && (
                  <Button size="sm" className="flex-1" onClick={() => update(o.id, "delivering")}>
                    Picked up — mulai antar
                  </Button>
                )}
                {o.status === "delivering" && (
                  <Button size="sm" className="flex-1" onClick={() => update(o.id, "completed")}>
                    Sudah diantar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Selesai (terbaru)</h2>
      <div className="space-y-2">
        {done.slice(0, 10).map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <span>#{o.order_no}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(o.created_at).toLocaleDateString("id-ID")}
            </span>
            <span className="font-medium">{formatIDR(Number(o.total))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
