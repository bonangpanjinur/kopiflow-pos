import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { Coffee, Check, Loader2, Phone, MapPin } from "lucide-react";

export const Route = createFileRoute("/track/$orderId")({
  component: TrackPage,
});

type Tracking = {
  id: string;
  order_no: string;
  status: string;
  fulfillment: string;
  total: number;
  delivery_fee: number;
  delivery_address: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
  shop_name: string;
  shop_slug: string;
  courier_name: string | null;
  courier_phone: string | null;
  courier_plate: string | null;
};

const STEPS_DELIVERY = [
  { key: "pending", label: "Menunggu konfirmasi" },
  { key: "preparing", label: "Sedang dibuat" },
  { key: "ready", label: "Siap diantar" },
  { key: "delivering", label: "Sedang diantar" },
  { key: "completed", label: "Terkirim" },
];

const STEPS_PICKUP = [
  { key: "pending", label: "Menunggu konfirmasi" },
  { key: "preparing", label: "Sedang dibuat" },
  { key: "ready", label: "Siap diambil" },
  { key: "completed", label: "Selesai" },
];

function TrackPage() {
  const { orderId } = useParams({ from: "/track/$orderId" });
  const [data, setData] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: rows, error } = await supabase.rpc("get_order_tracking", {
        _order_id: orderId,
      });
      if (cancelled) return;
      if (error || !rows || rows.length === 0) {
        setNotFound(true);
      } else {
        setData(rows[0] as Tracking);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        load
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Pesanan tidak ditemukan.</p>
      </div>
    );
  }

  const cancelled = data.status === "cancelled" || data.status === "voided";
  const steps = data.fulfillment === "delivery" ? STEPS_DELIVERY : STEPS_PICKUP;
  const currentIdx = steps.findIndex((s) => s.key === data.status);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{data.shop_name}</p>
            <p className="text-xs text-muted-foreground">Lacak pesanan</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Nomor pesanan</p>
              <p className="text-lg font-semibold">#{data.order_no}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">{formatIDR(Number(data.total))}</p>
            </div>
          </div>
          {Number(data.delivery_fee) > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Termasuk ongkir {formatIDR(Number(data.delivery_fee))}
            </p>
          )}
        </div>

        {cancelled ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
            Pesanan ini dibatalkan.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Status</h2>
            <ol className="space-y-3">
              {steps.map((s, i) => {
                const done = i <= currentIdx && currentIdx >= 0;
                const active = i === currentIdx;
                return (
                  <li key={s.key} className="flex items-start gap-3">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <div>
                      <p className={`text-sm ${active ? "font-semibold" : ""}`}>{s.label}</p>
                      {active && (
                        <p className="text-xs text-muted-foreground">
                          Diperbarui {new Date(data.updated_at).toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {data.fulfillment === "delivery" && data.courier_name && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium">Kurir</h2>
            <p className="font-semibold">{data.courier_name}</p>
            {data.courier_plate && (
              <p className="text-xs text-muted-foreground">Plat: {data.courier_plate}</p>
            )}
            {data.courier_phone && (
              <a
                href={`tel:${data.courier_phone}`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary"
              >
                <Phone className="h-3.5 w-3.5" /> {data.courier_phone}
              </a>
            )}
          </div>
        )}

        {data.delivery_address && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-1 text-sm font-medium">Alamat pengantaran</h2>
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {data.delivery_address}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
