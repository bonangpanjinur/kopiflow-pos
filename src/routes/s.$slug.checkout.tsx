import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  validatePromo,
  getLoyaltySettings,
  getUserPoints,
  calcPointsEarned,
  maxRedeemDiscount,
  applyPostOrder,
  type LoyaltySettings,
} from "@/lib/promo-loyalty";

export const Route = createFileRoute("/s/$slug/checkout")({
  component: CheckoutPage,
});

type Outlet = { id: string; name: string; address: string | null };
type Settings = {
  mode: "flat" | "zone";
  base_fee: number;
  free_above: number | null;
  min_order: number;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  open_time: string | null;
  close_time: string | null;
  notes: string | null;
};
type Zone = { id: string; name: string; fee: number; area_note: string | null };

function withinHours(open: string | null, close: string | null) {
  if (!open || !close) return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  if (c >= o) return cur >= o && cur <= c;
  // crosses midnight
  return cur >= o || cur <= c;
}

function CheckoutPage() {
  const { slug } = useParams({ from: "/s/$slug/checkout" });
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<CustomerCartItem[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState<string>("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<string>("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<{ id: string; code: string; discount: number } | null>(null);
  const [promoApplying, setPromoApplying] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltySettings | null>(null);
  const [pointBalance, setPointBalance] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);

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
      const [{ data: o }, { data: s }, { data: z }] = await Promise.all([
        supabase
          .from("outlets")
          .select("id,name,address")
          .eq("shop_id", shop.id)
          .eq("is_active", true)
          .order("created_at"),
        supabase.from("delivery_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
        supabase
          .from("delivery_zones")
          .select("id,name,fee,area_note")
          .eq("shop_id", shop.id)
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      setOutlets((o ?? []) as Outlet[]);
      if (o && o.length > 0) setOutletId(o[0].id);
      const settingsData = (s as Settings | null) ?? {
        mode: "flat" as const,
        base_fee: 0,
        free_above: null,
        min_order: 0,
        pickup_enabled: true,
        delivery_enabled: true,
        open_time: null,
        close_time: null,
        notes: null,
      };
      setSettings(settingsData);
      setZones((z ?? []) as Zone[]);
      // Default fulfillment based on enabled
      if (!settingsData.pickup_enabled && settingsData.delivery_enabled) setFulfillment("delivery");
      if (settingsData.pickup_enabled && !settingsData.delivery_enabled) setFulfillment("pickup");
      if (z && z.length > 0) setZoneId(z[0].id);
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

  // Load loyalty settings + balance once shop & user are known
  useEffect(() => {
    if (!shopId) return;
    getLoyaltySettings(shopId).then(setLoyalty);
  }, [shopId]);

  useEffect(() => {
    if (!shopId || !user) return;
    getUserPoints(shopId, user.id).then(setPointBalance);
  }, [shopId, user]);

  const subtotal = cartTotal(items);

  const deliveryFee = useMemo(() => {
    if (!settings || fulfillment !== "delivery") return 0;
    if (settings.free_above != null && subtotal >= settings.free_above) return 0;
    if (settings.mode === "flat") return Number(settings.base_fee) || 0;
    const z = zones.find((x) => x.id === zoneId);
    return z ? Number(z.fee) || 0 : 0;
  }, [settings, fulfillment, subtotal, zones, zoneId]);

  const promoDiscount = promo?.discount ?? 0;
  const redeemCap = useMemo(
    () => maxRedeemDiscount(subtotal, pointBalance, loyalty),
    [subtotal, pointBalance, loyalty],
  );
  const effectiveRedeem = Math.min(redeemPoints, redeemCap.maxPoints);
  const pointsValue = effectiveRedeem * (loyalty?.point_value ?? 0);
  const total = Math.max(0, subtotal - promoDiscount - pointsValue + deliveryFee);
  const pointsEarned = calcPointsEarned(Math.max(0, subtotal - promoDiscount), loyalty);

  const minOrderOk = !settings || subtotal >= (settings.min_order || 0);
  const hoursOk = !settings || fulfillment === "pickup" || withinHours(settings.open_time, settings.close_time);

  async function applyPromoCode() {
    if (!shopId || !promoCode.trim()) return;
    setPromoApplying(true);
    const res = await validatePromo(shopId, promoCode.trim(), subtotal, "online");
    setPromoApplying(false);
    if (res.error || !res.promo_id) {
      setPromo(null);
      return toast.error(res.error ?? "Promo tidak valid");
    }
    setPromo({ id: res.promo_id, code: res.code, discount: res.discount });
    toast.success(`Promo ${res.code} dipakai`);
  }

  async function submit() {
    if (!user) {
      navigate({ to: "/s/$slug/login", params: { slug }, search: { redirect: `/s/${slug}/checkout` } });
      return;
    }
    if (!shopId || !outletId) return toast.error("Outlet belum tersedia");
    if (items.length === 0) return toast.error("Keranjang kosong");
    if (!name.trim() || !phone.trim()) return toast.error("Nama dan nomor HP wajib diisi");
    if (!minOrderOk) return toast.error(`Minimum order ${formatIDR(settings!.min_order)}`);
    if (!hoursOk) return toast.error("Di luar jam delivery");
    if (fulfillment === "delivery") {
      if (!settings?.delivery_enabled) return toast.error("Delivery tidak tersedia");
      if (!address.trim()) return toast.error("Alamat pengiriman wajib diisi");
      if (settings.mode === "zone" && !zoneId) return toast.error("Pilih zona pengiriman");
    }
    if (fulfillment === "pickup" && !settings?.pickup_enabled) {
      return toast.error("Pickup tidak tersedia");
    }

    setSubmitting(true);
    try {
      await supabase.from("customer_profiles").upsert(
        {
          user_id: user.id,
          display_name: name.trim(),
          phone: phone.trim(),
          email: user.email,
        },
        { onConflict: "user_id" },
      );

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
          delivery_zone_id: fulfillment === "delivery" && settings?.mode === "zone" ? zoneId : null,
          note: note.trim() || null,
          subtotal,
          tax: 0,
          discount: promoDiscount + pointsValue,
          delivery_fee: deliveryFee,
          total,
          promo_id: promo?.id ?? null,
          promo_code: promo?.code ?? null,
          points_earned: pointsEarned,
          points_redeemed: effectiveRedeem,
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

      await applyPostOrder({
        shopId,
        orderId: order.id,
        userId: user.id,
        promoId: promo?.id ?? null,
        promoDiscount,
        pointsEarned,
        pointsRedeemed: effectiveRedeem,
      });

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

  const pickupOk = settings?.pickup_enabled !== false;
  const deliveryOk = settings?.delivery_enabled !== false;

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
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${fulfillment === "pickup" ? "border-primary bg-accent" : "border-border"} ${!pickupOk ? "opacity-50" : ""}`}>
            <RadioGroupItem value="pickup" disabled={!pickupOk} />
            <span className="text-sm font-medium">Pickup di toko</span>
          </label>
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${fulfillment === "delivery" ? "border-primary bg-accent" : "border-border"} ${!deliveryOk ? "opacity-50" : ""}`}>
            <RadioGroupItem value="delivery" disabled={!deliveryOk} />
            <span className="text-sm font-medium">Delivery</span>
          </label>
        </RadioGroup>
        {settings?.notes && <p className="pt-1 text-xs text-muted-foreground">ℹ️ {settings.notes}</p>}
        {settings?.open_time && settings?.close_time && fulfillment === "delivery" && (
          <p className="text-xs text-muted-foreground">
            Jam delivery: {settings.open_time} – {settings.close_time}
          </p>
        )}
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

      {fulfillment === "delivery" && settings?.mode === "zone" && zones.length > 0 && (
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Zona pengiriman</h2>
          <RadioGroup value={zoneId} onValueChange={setZoneId} className="space-y-2">
            {zones.map((z) => (
              <label key={z.id} className={`flex cursor-pointer items-start justify-between gap-2 rounded-lg border p-3 ${zoneId === z.id ? "border-primary bg-accent" : "border-border"}`}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value={z.id} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{z.name}</p>
                    {z.area_note && <p className="text-xs text-muted-foreground">{z.area_note}</p>}
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatIDR(Number(z.fee))}</span>
              </label>
            ))}
          </RadioGroup>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Kontak</h2>
        <div className="space-y-1">
          <Label className="text-xs">Nama</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nomor HP</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
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
        <div className="space-y-1 border-t border-border pt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(subtotal)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className="flex justify-between text-primary">
              <span>Promo {promo?.code}</span>
              <span>−{formatIDR(promoDiscount)}</span>
            </div>
          )}
          {pointsValue > 0 && (
            <div className="flex justify-between text-primary">
              <span>Tukar {effectiveRedeem} poin</span>
              <span>−{formatIDR(pointsValue)}</span>
            </div>
          )}
          {fulfillment === "delivery" && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Ongkir{settings?.free_above != null && subtotal >= settings.free_above ? " (gratis)" : ""}
              </span>
              <span>{formatIDR(deliveryFee)}</span>
            </div>
          )}
          {settings?.free_above != null && subtotal < settings.free_above && fulfillment === "delivery" && (
            <p className="text-xs text-muted-foreground">
              Belanja {formatIDR(settings.free_above - subtotal)} lagi untuk gratis ongkir
            </p>
          )}
          {settings?.min_order ? (
            <p className={`text-xs ${minOrderOk ? "text-muted-foreground" : "text-destructive"}`}>
              Minimum order {formatIDR(settings.min_order)}
            </p>
          ) : null}
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
          <Button onClick={submit} disabled={submitting || !minOrderOk || !hoursOk}>
            {submitting ? "Mengirim…" : "Kirim pesanan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
