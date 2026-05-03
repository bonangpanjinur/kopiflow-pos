import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/lib/customer-cart";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, RotateCw, Star } from "lucide-react";
import { ReviewDialog } from "@/components/customer/ReviewDialog";

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
  payment_status: "unpaid" | "awaiting_verification" | "paid" | "refunded";
  payment_method: string;
};

type OrderItem = {
  id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  note: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu konfirmasi", cls: "bg-yellow-100 text-yellow-800" },
  preparing: { label: "Sedang dibuat", cls: "bg-blue-100 text-blue-800" },
  ready: { label: "Siap diambil", cls: "bg-green-100 text-green-800" },
  delivering: { label: "Sedang diantar", cls: "bg-purple-100 text-purple-800" },
  completed: { label: "Selesai", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Dibatalkan", cls: "bg-red-100 text-red-800" },
  voided: { label: "Dibatalkan", cls: "bg-red-100 text-red-800" },
  refunded: { label: "Direfund", cls: "bg-gray-100 text-gray-800" },
};

function MyOrders() {
  const { slug } = useParams({ from: "/s/$slug/orders" });
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, OrderItem[]>>({});
  const [prevStatus, setPrevStatus] = useState<Record<string, string>>({});
  const [reviewOrder, setReviewOrder] = useState<{ id: string; items: OrderItem[] } | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);

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
        .select("id,order_no,created_at,status,fulfillment,total,delivery_address,payment_status,payment_method")
        .eq("customer_user_id", user.id)
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        const next = (data ?? []) as Order[];
        // Toast on status change
        setPrevStatus((prev) => {
          const updated: Record<string, string> = { ...prev };
          for (const o of next) {
            if (prev[o.id] && prev[o.id] !== o.status) {
              const lbl = STATUS_LABEL[o.status]?.label ?? o.status;
              toast.info(`Pesanan #${o.order_no}: ${lbl}`);
            }
            updated[o.id] = o.status;
          }
          return updated;
        });
        setOrders(next);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, slug]);

  const loadItems = async (orderId: string) => {
    if (itemsCache[orderId]) return;
    const { data } = await supabase
      .from("order_items")
      .select("id,menu_item_id,name,quantity,unit_price,subtotal,note")
      .eq("order_id", orderId);
    setItemsCache((prev) => ({ ...prev, [orderId]: (data ?? []) as OrderItem[] }));
  };

  const reorder = async (orderId: string) => {
    let list = itemsCache[orderId];
    if (!list) {
      const { data } = await supabase
        .from("order_items")
        .select("id,menu_item_id,name,quantity,unit_price,subtotal,note")
        .eq("order_id", orderId);
      list = (data ?? []) as OrderItem[];
    }
    // Verify which menu items still available
    const ids = list.map((i) => i.menu_item_id).filter(Boolean) as string[];
    if (ids.length === 0) {
      toast.error("Tidak ada item yang bisa dipesan ulang");
      return;
    }
    const { data: menus } = await supabase
      .from("menu_items")
      .select("id,name,price,image_url,is_available")
      .in("id", ids);
    const avail = new Map((menus ?? []).filter((m) => m.is_available).map((m) => [m.id, m]));
    let added = 0;
    let skipped = 0;
    for (const it of list) {
      if (it.menu_item_id && avail.has(it.menu_item_id)) {
        const m = avail.get(it.menu_item_id)!;
        addToCart(
          slug,
          {
            menu_item_id: m.id,
            name: m.name,
            price: Number(m.price),
            image_url: m.image_url,
            note: it.note ?? undefined,
          },
          it.quantity,
        );
        added++;
      } else {
        skipped++;
      }
    }
    if (added) toast.success(`${added} item ditambahkan ke keranjang${skipped ? ` (${skipped} habis)` : ""}`);
    else toast.error("Semua item sudah tidak tersedia");
  };

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
        const isOpen = openId === o.id;
        const items = itemsCache[o.id];
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
            {o.payment_status === "unpaid" && o.payment_method !== "cash" && o.status === "pending" && (
              <Link to="/s/$slug/pay/$orderId" params={{ slug, orderId: o.id }} className="mt-2 block">
                <Button size="sm" className="w-full">Bayar sekarang</Button>
              </Link>
            )}
            {o.payment_status === "awaiting_verification" && (
              <p className="mt-2 text-xs text-amber-600">⏳ Menunggu verifikasi pembayaran</p>
            )}
            {o.payment_status === "paid" && (
              <p className="mt-2 text-xs text-emerald-600">✓ Pembayaran terverifikasi</p>
            )}

            {isOpen && items && (
              <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs">
                {items.map((it) => (
                  <div key={it.id} className="flex justify-between py-0.5">
                    <span>
                      {it.quantity}× {it.name}
                      {it.note && <span className="text-muted-foreground"> — {it.note}</span>}
                    </span>
                    <span>{formatIDR(Number(it.subtotal))}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (isOpen) {
                    setOpenId(null);
                  } else {
                    setOpenId(o.id);
                    loadItems(o.id);
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {isOpen ? "Sembunyikan item" : "Lihat item"}
              </button>
              <Link
                to="/track/$orderId"
                params={{ orderId: o.id }}
                className="inline-block text-xs font-medium text-primary hover:underline"
              >
                Lacak →
              </Link>
              <button
                onClick={() => reorder(o.id)}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
              >
                <RotateCw className="h-3 w-3" /> Pesan lagi
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
