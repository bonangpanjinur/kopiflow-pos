import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Loader2, ChefHat, Clock, CheckCircle2, Bell } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export const Route = createFileRoute("/app/kds")({
  component: KDSPage,
});

type Order = {
  id: string;
  order_no: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  fulfillment: string;
  created_at: string;
  customer_name: string | null;
  note: string | null;
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  note: string | null;
  options?: any[];
};

function KDSPage() {
  const { shop, outlet, loading: loadingShop } = useCurrentShop();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!outlet) return;

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_no, status, fulfillment, created_at, customer_name, note")
        .eq("outlet_id", outlet.id)
        .in("status", ["pending", "preparing"])
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("Gagal mengambil data pesanan");
      } else {
        setOrders(data as Order[]);
        // Fetch items for these orders
        if (data.length > 0) {
          const orderIds = data.map((o) => o.id);
          const { data: itemData } = await supabase
            .from("order_items")
            .select("id, order_id, name, quantity, note")
            .in("order_id", orderIds);
          
          if (itemData) {
            const grouped = itemData.reduce((acc: any, item: any) => {
              if (!acc[item.order_id]) acc[item.order_id] = [];
              acc[item.order_id].push(item);
              return acc;
            }, {});
            setItems(grouped);
          }
        }
      }
      setLoading(false);
    };

    fetchOrders();

    const channel = supabase
      .channel(`kds-${outlet.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `outlet_id=eq.${outlet.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as Order;
            if (["pending", "preparing"].includes(newOrder.status)) {
              setOrders((prev) => [...prev, newOrder]);
              // Fetch items for new order
              supabase
                .from("order_items")
                .select("id, order_id, name, quantity, note")
                .eq("order_id", newOrder.id)
                .then(({ data }) => {
                  if (data) {
                    setItems((prev) => ({ ...prev, [newOrder.id]: data as OrderItem[] }));
                  }
                });
              
              // Play sound or notify
              const audio = new Audio("/notification.mp3");
              audio.play().catch(() => {});
              toast.info(`Pesanan baru #${newOrder.order_no}`);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Order;
            if (["pending", "preparing"].includes(updated.status)) {
              setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            } else {
              setOrders((prev) => prev.filter((o) => o.id !== updated.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [outlet]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    
    if (error) {
      toast.error("Gagal memperbarui status");
    } else {
      toast.success(`Pesanan ${status === "preparing" ? "mulai diproses" : "siap"}`);
    }
  };

  if (loadingShop || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-slate-800 px-6 bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Kitchen Display System</h1>
            <p className="text-xs text-slate-400">{outlet?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">{format(new Date(), "EEEE, d MMMM", { locale: id })}</div>
            <div className="text-xs text-slate-400">Real-time Sync Active</div>
          </div>
          <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 hover:bg-slate-700">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Grid */}
      <main className="flex-1 overflow-x-auto p-6">
        {orders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <ChefHat className="mb-4 h-16 w-16 opacity-10" />
            <p className="text-lg font-medium">Belum ada pesanan masuk</p>
            <p className="text-sm">Pesanan dari POS atau Online akan muncul di sini</p>
          </div>
        ) : (
          <div className="flex gap-6 h-full items-start">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`flex w-80 shrink-0 flex-col rounded-xl border-2 bg-slate-900 shadow-2xl transition-all ${
                  order.status === "preparing" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-800"
                }`}
              >
                {/* Card Header */}
                <div className={`p-4 rounded-t-lg ${order.status === "preparing" ? "bg-blue-600" : "bg-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black">#{order.order_no}</span>
                    <div className="flex items-center gap-1 text-xs font-medium opacity-80">
                      <Clock className="h-3 w-3" />
                      {format(new Date(order.created_at), "HH:mm")}
                    </div>
                  </div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-wider opacity-90">
                    {order.customer_name || "Pelanggan"} • {order.fulfillment}
                  </div>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
                  {items[order.id]?.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-800 text-sm font-bold">
                        {item.quantity}x
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold leading-tight">{item.name}</div>
                        {item.note && (
                          <div className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-400 border border-amber-500/20">
                            Catatan: {item.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {order.note && (
                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <div className="text-[10px] uppercase text-slate-500 font-bold">Order Note</div>
                      <div className="text-xs text-slate-300 italic">{order.note}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-800">
                  {order.status === "pending" ? (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12"
                      onClick={() => updateStatus(order.id, "preparing")}
                    >
                      MULAI PROSES
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12"
                      onClick={() => updateStatus(order.id, "ready")}
                    >
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      SIAP SAJI
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
