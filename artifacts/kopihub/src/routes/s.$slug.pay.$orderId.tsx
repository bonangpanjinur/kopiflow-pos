import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, QrCode, Upload, CheckCircle2, ImageIcon, Clock as ClockIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/s/$slug/pay/$orderId")({
  component: PayPage,
});

type Order = {
  id: string;
  order_no: string;
  total: number;
  status: string;
  payment_status: "unpaid" | "awaiting_verification" | "paid" | "refunded";
  payment_proof_url: string | null;
  shop_id: string;
  customer_user_id: string | null;
};

type Shop = {
  id: string;
  name: string;
  qris_image_url: string | null;
  qris_merchant_name: string | null;
};

function PayPage() {
  const { slug, orderId } = useParams({ from: "/s/$slug/pay/$orderId" });
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/s/$slug/login", params: { slug }, search: { redirect: `/s/${slug}/pay/${orderId}` } });
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data: o } = await supabase
        .from("orders")
        .select("id, order_no, total, status, payment_status, payment_proof_url, shop_id, customer_user_id")
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled) return;
      if (!o) {
        toast.error("Pesanan tidak ditemukan");
        navigate({ to: "/s/$slug/orders", params: { slug } });
        return;
      }
      setOrder(o as Order);
      const { data: s } = await supabase
        .from("coffee_shops")
        .select("id, name, qris_image_url, qris_merchant_name")
        .eq("id", o.shop_id)
        .maybeSingle();
      if (!cancelled) {
        setShop(s as Shop | null);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`order-pay-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId, slug, user, authLoading, navigate]);

  const upload = async (file: File) => {
    if (!order || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran maksimal 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${order.shop_id}/${order.id}/proof-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("payment-proofs")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    // Store the storage path; signed URLs are generated on demand at view time.
    const { error: updErr } = await supabase
      .from("orders")
      .update({
        payment_proof_url: path,
        payment_status: "awaiting_verification",
        payment_method: "qris",
      })
      .eq("id", order.id);
    setUploading(false);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    toast.success("Bukti bayar terkirim, menunggu verifikasi toko");
  };

  const viewProof = async () => {
    if (!order?.payment_proof_url) return;
    const { data, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(order.payment_proof_url, 60 * 10);
    if (error || !data) {
      toast.error("Gagal membuka bukti");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (authLoading || loading || !order || !shop) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPaid = order.payment_status === "paid";
  const isPending = order.payment_status === "awaiting_verification";
  const noQris = !shop.qris_image_url;

  return (
    <div className="space-y-4 pb-8">
      <Link
        to="/s/$slug/orders"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pesanan saya
      </Link>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Order</p>
            <p className="text-base font-semibold">#{order.order_no}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold tabular-nums">{formatIDR(Number(order.total))}</p>
          </div>
        </div>
      </div>

      {isPaid ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-2 text-base font-semibold">Pembayaran terverifikasi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Terima kasih! Pesanan Anda sedang diproses.
          </p>
          <Link to="/track/$orderId" params={{ orderId: order.id }} className="mt-3 inline-block">
            <Button size="sm" variant="outline">Lacak pesanan</Button>
          </Link>
        </div>
      ) : isPending ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
          <ClockIcon className="mx-auto h-10 w-10 text-amber-600" />
          <h2 className="mt-2 text-base font-semibold">Menunggu verifikasi toko</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bukti bayar Anda telah dikirim. Toko akan memverifikasi sebentar lagi.
          </p>
          {order.payment_proof_url && (
            <button
              onClick={viewProof}
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Lihat bukti
            </button>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Salah upload?{" "}
            <button onClick={() => fileRef.current?.click()} className="text-primary hover:underline">
              Ganti bukti
            </button>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : noQris ? (
        <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
          Toko belum mengaktifkan QRIS. Silakan bayar di tempat saat pickup atau ke kurir.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Scan QRIS untuk bayar</h2>
            </div>
            <div className="mx-auto max-w-xs">
              <img
                src={shop.qris_image_url ?? ""}
                alt="QRIS"
                className="w-full rounded-lg border border-border bg-white object-contain"
              />
              {shop.qris_merchant_name && (
                <p className="mt-2 text-center text-sm font-medium">{shop.qris_merchant_name}</p>
              )}
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Bayar tepat <b>{formatIDR(Number(order.total))}</b>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold">Upload bukti bayar</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Setelah transfer, upload screenshot bukti agar toko bisa verifikasi.
            </p>
            <Button
              className="w-full gap-2"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Mengunggah…" : "Pilih gambar bukti"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
