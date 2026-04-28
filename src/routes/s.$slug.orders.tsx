import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/s/$slug/orders")({
  component: MyOrders,
});

type Order = {
  id: string;
  order_no: string;
  created_at: string;
  status: string;
  fulfillment: string;
  total: number;
  delivery_address: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu konfirmasi", cls: "bg-yellow-100 text-yellow-800" },
  preparing: { label: "Sedang dibuat", cls: "bg-blue-100 text-blue-800" },
  ready: { label: "Siap diambil", cls: "bg-green-100 text-green-800" },
  completed: { label: "Selesai", cls: "bg-emerald-100 text-emerald-800" },
  voided: { label: "Dibatalkan", cls: "bg-red-100 text-red-800" },
  refunded: { label: "Direfund", cls: "bg-gray-100 text-gray-800" },
};

function MyOrders() {
  const { slug } = useParams({ from: "/s/$slug/orders" });
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data: shop } = await supabase
        .from("coffee_shops")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!shop || cancelled) return;
      const { data } = await supabase
        .from("orders")
        .select("id,order_no,created_at,status,fulfillment,total,delivery_address")
        .eq("customer_user_id", user.id)
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setOrders((data ?? []) as Order[]);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`my-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `customer_user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, slug]);

  if (authLoading) return <p className="text-muted-foreground text-sm">Memuat…</p>;

  if (!user) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">Masuk untuk lihat pesanan Anda</p>
        <Link to="/s/$slug/login" params={{ slug }} search={{ redirect: `/s/${slug}/orders` }}>
          <Button>Masuk</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Pesanan saya</h1>
      {loading && <p className="text-sm text-muted-foreground">Memuat…</p>}
      {!loading && orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Belum ada pesanan</p>
          <Link to="/s/$slug" params={{ slug }} className="mt-3 inline-block">
            <Button size="sm">Lihat menu</Button>
          </Link>
        </div>
      )}
      {orders.map((o) => {
        const st = STATUS_LABEL[o.status] ?? { label: o.status, cls: "bg-gray-100 text-gray-800" };
        return (
          <div key={o.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">#{o.order_no}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("id-ID")}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground capitalize">{o.fulfillment}</span>
              <span className="font-semibold">{formatIDR(Number(o.total))}</span>
            </div>
            {o.delivery_address && (
              <p className="mt-1 text-xs text-muted-foreground">📍 {o.delivery_address}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
