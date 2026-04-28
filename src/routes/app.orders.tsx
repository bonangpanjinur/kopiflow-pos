import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Loader2, ListOrdered, Banknote, QrCode, Printer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Receipt } from "@/components/pos/receipt";
import type { CartItem } from "@/lib/cart";
import { useRef } from "react";

export const Route = createFileRoute("/app/orders")({
  component: OrdersPage,
});

type Order = {
  id: string;
  order_no: string;
  total: number;
  payment_method: "cash" | "qris";
  amount_tendered: number | null;
  change_due: number;
  status: string;
  created_at: string;
  customer_name: string | null;
  cashier_id: string;
};

type OrderDetail = Order & {
  order_items: {
    name: string;
    unit_price: number;
    quantity: number;
    note: string | null;
  }[];
};

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function OrdersPage() {
  const { shop, outlet, loading: shopLoading } = useCurrentShop();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderDetail | null>(null);

  async function load() {
    if (!outlet) return;
    setLoading(true);
    const today = todayJakarta();
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_no, total, payment_method, amount_tendered, change_due, status, created_at, customer_name, cashier_id",
      )
      .eq("outlet_id", outlet.id)
      .eq("business_date", today)
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!outlet) return;
    load();
    const channel = supabase
      .channel(`orders_${outlet.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `outlet_id=eq.${outlet.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?.id]);

  async function openDetail(o: Order) {
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_no, total, payment_method, amount_tendered, change_due, status, created_at, customer_name, cashier_id, order_items(name, unit_price, quantity, note)",
      )
      .eq("id", o.id)
      .single();
    if (data) setSelected(data as unknown as OrderDetail);
  }

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalToday = orders
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + Number(o.total), 0);
  const countToday = orders.filter((o) => o.status === "completed").length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Order Hari Ini</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {outlet?.name} · {new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Penjualan</div>
          <div className="mt-1 text-2xl font-bold">{formatIDR(totalToday)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Jumlah order</div>
          <div className="mt-1 text-2xl font-bold">{countToday}</div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ListOrdered className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Belum ada order hari ini</h2>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">No</th>
                <th className="px-4 py-2 text-left">Waktu</th>
                <th className="px-4 py-2 text-left">Bayar</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => {
                const voided = o.status === "voided" || o.status === "cancelled";
                return (
                <tr key={o.id} className={`hover:bg-muted/30 ${voided ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2.5 font-medium">
                    #{o.order_no}
                    {voided && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">VOID</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {o.payment_method === "cash" ? (
                        <Banknote className="h-3 w-3" />
                      ) : (
                        <QrCode className="h-3 w-3" />
                      )}
                      {o.payment_method === "cash" ? "Tunai" : "QRIS"}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${voided ? "line-through" : ""}`}>{formatIDR(o.total)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openDetail(o)}>
                      Detail
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && shop && outlet && (
        <DetailDialog
          order={selected}
          shopName={shop.name}
          outletName={outlet.name}
          onClose={() => setSelected(null)}
          onVoided={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DetailDialog({
  order,
  shopName,
  outletName,
  onClose,
  onVoided,
}: {
  order: OrderDetail;
  shopName: string;
  outletName: string;
  onClose: () => void;
  onVoided: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [voiding, setVoiding] = useState(false);
  const isVoided = order.status === "voided" || order.status === "cancelled";
  const items: CartItem[] = order.order_items.map((i) => ({
    menu_item_id: "",
    name: i.name,
    unit_price: Number(i.unit_price),
    quantity: i.quantity,
    note: i.note ?? undefined,
  }));

  function handlePrint() {
    if (printRef.current) {
      printRef.current.classList.add("print-area");
      window.print();
      printRef.current.classList.remove("print-area");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Order #{order.order_no}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleString("id-ID")}
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((it, k) => (
              <li key={k} className="px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span>
                    {it.quantity}× {it.name}
                  </span>
                  <span>{formatIDR(it.unit_price * it.quantity)}</span>
                </div>
                {it.note && (
                  <div className="mt-0.5 text-xs italic text-muted-foreground">📝 {it.note}</div>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-between rounded-lg bg-muted p-3 text-sm font-semibold">
            <span>Total</span>
            <span>{formatIDR(order.total)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Bayar via {order.payment_method === "cash" ? "Tunai" : "QRIS"}
            {order.payment_method === "cash" && order.amount_tendered != null && (
              <> · diterima {formatIDR(Number(order.amount_tendered))} · kembali {formatIDR(Number(order.change_due))}</>
            )}
          </div>
          <div className="hidden">
            <div ref={printRef}>
              <Receipt
                shopName={shopName}
                outletName={outletName}
                orderNo={order.order_no}
                cashierName="Kasir"
                date={new Date(order.created_at)}
                items={items}
                subtotal={Number(order.total)}
                total={Number(order.total)}
                paymentMethod={order.payment_method}
                amountTendered={order.amount_tendered ? Number(order.amount_tendered) : undefined}
                changeDue={Number(order.change_due)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {!isVoided && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={voiding}
              onClick={async () => {
                const reason = prompt("Alasan void? (opsional)") ?? "";
                if (!confirm(`Void order #${order.order_no}? Stok & poin akan dibalik.`)) return;
                setVoiding(true);
                const { error } = await supabase.rpc("void_order", { _order_id: order.id, _reason: reason });
                setVoiding(false);
                if (error) return toast.error(error.message);
                toast.success("Order di-void");
                onVoided();
              }}
            >
              <XCircle className="mr-2 h-4 w-4" /> {voiding ? "Memproses…" : "Void order"}
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Cetak ulang
          </Button>
          <Button onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
