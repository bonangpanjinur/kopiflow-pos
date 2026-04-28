import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { readCart, cartTotal, clearCart, type CustomerCartItem } from "@/lib/customer-cart";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/s/$slug/checkout")({
  component: CheckoutPage,
});

type Outlet = { id: string; name: string; address: string | null };

function CheckoutPage() {
  const { slug } = useParams({ from: "/s/$slug/checkout" });
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<CustomerCartItem[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState<string>("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setItems(readCart(slug));
  }, [slug]);

  useEffect(() => {
    (async () => {
      const { data: shop } = await supabase
        .from("coffee_shops")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!shop) return;
      setShopId(shop.id);
      const { data: o } = await supabase
        .from("outlets")
        .select("id,name,address")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("created_at");
      setOutlets((o ?? []) as Outlet[]);
      if (o && o.length > 0) setOutletId(o[0].id);
    })();
  }, [slug]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("customer_profiles")
      .select("display_name,phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.display_name || user.user_metadata?.display_name || "");
          setPhone(data.phone || "");
        } else {
          setName(user.user_metadata?.display_name || user.email?.split("@")[0] || "");
        }
      });
  }, [user]);

  const subtotal = cartTotal(items);
  const total = subtotal; // delivery fee fase 8

  async function submit() {
    if (!user) {
      navigate({ to: "/s/$slug/login", params: { slug }, search: { redirect: `/s/${slug}/checkout` } });
      return;
    }
    if (!shopId || !outletId) {
      toast.error("Outlet belum tersedia");
      return;
    }
    if (items.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast.error("Nama dan nomor HP wajib diisi");
      return;
    }
    if (fulfillment === "delivery" && !address.trim()) {
      toast.error("Alamat pengiriman wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      // Upsert customer profile
      await supabase.from("customer_profiles").upsert(
        {
          user_id: user.id,
          display_name: name.trim(),
          phone: phone.trim(),
          email: user.email,
        },
        { onConflict: "user_id" },
      );

      // Generate order_no via RPC
      const { data: orderNo } = await supabase.rpc("next_order_no", { _outlet_id: outletId });

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          shop_id: shopId,
          outlet_id: outletId,
          order_no: orderNo ?? "001",
          channel: "online",
          fulfillment,
          status: "pending",
          payment_method: "cash",
          customer_user_id: user.id,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          delivery_address: fulfillment === "delivery" ? address.trim() : null,
          note: note.trim() || null,
          subtotal,
          tax: 0,
          discount: 0,
          delivery_fee: 0,
          total,
        })
        .select("id,order_no")
        .single();

      if (orderErr || !order) throw orderErr ?? new Error("Gagal buat order");

      const itemsPayload = items.map((i) => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        name: i.name,
        unit_price: i.price,
        quantity: i.qty,
        subtotal: i.price * i.qty,
        note: i.note ?? null,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      clearCart(slug);
      toast.success(`Order #${order.order_no} terkirim!`);
      navigate({ to: "/s/$slug/orders", params: { slug } });
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat pesanan");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <p className="text-muted-foreground text-sm">Memuat…</p>;

  if (!user) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">Masuk dulu untuk checkout</p>
        <Link to="/s/$slug/login" params={{ slug }} search={{ redirect: `/s/${slug}/checkout` }}>
          <Button>Masuk / Daftar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <Link
        to="/s/$slug/cart"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <h1 className="text-lg font-semibold">Checkout</h1>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Metode</h2>
        <RadioGroup
          value={fulfillment}
          onValueChange={(v) => setFulfillment(v as "pickup" | "delivery")}
          className="grid grid-cols-2 gap-2"
        >
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${fulfillment === "pickup" ? "border-primary bg-accent" : "border-border"}`}>
            <RadioGroupItem value="pickup" />
            <span className="text-sm font-medium">Pickup di toko</span>
          </label>
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${fulfillment === "delivery" ? "border-primary bg-accent" : "border-border"}`}>
            <RadioGroupItem value="delivery" />
            <span className="text-sm font-medium">Delivery</span>
          </label>
        </RadioGroup>
      </section>

      {outlets.length > 1 && (
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Outlet</h2>
          <RadioGroup value={outletId} onValueChange={setOutletId} className="space-y-2">
            {outlets.map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${outletId === o.id ? "border-primary bg-accent" : "border-border"}`}>
                <RadioGroupItem value={o.id} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{o.name}</p>
                  {o.address && <p className="text-xs text-muted-foreground">{o.address}</p>}
                </div>
              </label>
            ))}
          </RadioGroup>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Kontak</h2>
        <div className="space-y-1">
          <Label className="text-xs">Nama</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama penerima" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nomor HP</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" />
        </div>
        {fulfillment === "delivery" && (
          <div className="space-y-1">
            <Label className="text-xs">Alamat pengiriman</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jalan, nomor, RT/RW, patokan…"
              rows={3}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Catatan untuk toko</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Ringkasan</h2>
        <div className="space-y-1 text-sm">
          {items.map((i) => (
            <div key={i.menu_item_id} className="flex justify-between">
              <span className="text-muted-foreground">
                {i.qty}× {i.name}
              </span>
              <span>{formatIDR(i.price * i.qty)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatIDR(total)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Pembayaran: bayar di tempat (Cash/QRIS) saat pickup atau ke kurir.
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-base font-semibold">{formatIDR(total)}</p>
          </div>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Mengirim…" : "Kirim pesanan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
