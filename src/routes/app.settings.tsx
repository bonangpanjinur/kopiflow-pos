import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, Trash2, Store, Phone, MapPin, Clock, Share2, Save, Image as ImageIcon, QrCode, CreditCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type DayHours = { open: string; close: string; closed: boolean };
type OpenHours = Record<DayKey, DayHours>;

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Senin" },
  { key: "tue", label: "Selasa" },
  { key: "wed", label: "Rabu" },
  { key: "thu", label: "Kamis" },
  { key: "fri", label: "Jumat" },
  { key: "sat", label: "Sabtu" },
  { key: "sun", label: "Minggu" },
];

const DEFAULT_HOURS: OpenHours = {
  mon: { open: "08:00", close: "22:00", closed: false },
  tue: { open: "08:00", close: "22:00", closed: false },
  wed: { open: "08:00", close: "22:00", closed: false },
  thu: { open: "08:00", close: "22:00", closed: false },
  fri: { open: "08:00", close: "22:00", closed: false },
  sat: { open: "08:00", close: "22:00", closed: false },
  sun: { open: "08:00", close: "22:00", closed: false },
};

type PaymentMethod = "cash" | "qris" | "transfer";

type ShopRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  instagram: string | null;
  whatsapp: string | null;
  open_hours: OpenHours | null;
  qris_image_url: string | null;
  qris_merchant_name: string | null;
  payment_methods_enabled: PaymentMethod[];
};

function SettingsPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qrisFileRef = useRef<HTMLInputElement>(null);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [form, setForm] = useState<ShopRow | null>(null);

  useEffect(() => {
    if (!shop) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("coffee_shops")
        .select("id, name, slug, description, tagline, logo_url, phone, email, address, instagram, whatsapp, open_hours, qris_image_url, qris_merchant_name, payment_methods_enabled")
        .eq("id", shop.id)
        .maybeSingle();
      if (data) {
        setForm({
          ...data,
          open_hours: (data.open_hours as OpenHours | null) ?? DEFAULT_HOURS,
          payment_methods_enabled: (data.payment_methods_enabled ?? ["cash", "qris"]) as PaymentMethod[],
        } as ShopRow);
      }
      setLoading(false);
    })();
  }, [shop]);

  if (shopLoading || loading || !form) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const update = <K extends keyof ShopRow>(k: K, v: ShopRow[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const updateHour = (day: DayKey, patch: Partial<DayHours>) =>
    setForm((f) =>
      f
        ? {
            ...f,
            open_hours: {
              ...(f.open_hours ?? DEFAULT_HOURS),
              [day]: { ...(f.open_hours ?? DEFAULT_HOURS)[day], ...patch },
            },
          }
        : f
    );

  const onUpload = async (file: File) => {
    if (!shop) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran maksimal 2MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${shop.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("shop-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("shop-logos").getPublicUrl(path);
    update("logo_url", pub.publicUrl);
    setUploading(false);
    toast.success("Logo terunggah, simpan untuk menerapkan");
  };

  const onRemoveLogo = () => update("logo_url", null);

  const onUploadQris = async (file: File) => {
    if (!shop) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran maksimal 2MB");
    setUploadingQris(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${shop.id}/qris-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("shop-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      toast.error(upErr.message);
      setUploadingQris(false);
      return;
    }
    const { data: pub } = supabase.storage.from("shop-logos").getPublicUrl(path);
    update("qris_image_url", pub.publicUrl);
    setUploadingQris(false);
    toast.success("QRIS terunggah, simpan untuk menerapkan");
  };

  const togglePayment = (m: PaymentMethod) => {
    setForm((f) => {
      if (!f) return f;
      const enabled = f.payment_methods_enabled ?? [];
      const next = enabled.includes(m) ? enabled.filter((x) => x !== m) : [...enabled, m];
      return { ...f, payment_methods_enabled: next.length ? next : ["cash"] };
    });
  };

  const onSave = async () => {
    if (!shop || !form) return;
    setSaving(true);
    const { error } = await supabase
      .from("coffee_shops")
      .update({
        name: form.name,
        description: form.description,
        tagline: form.tagline,
        logo_url: form.logo_url,
        phone: form.phone,
        email: form.email,
        address: form.address,
        instagram: form.instagram,
        whatsapp: form.whatsapp,
        open_hours: form.open_hours as never,
        qris_image_url: form.qris_image_url,
        qris_merchant_name: form.qris_merchant_name,
        payment_methods_enabled: form.payment_methods_enabled,
      })
      .eq("id", shop.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pengaturan tersimpan");
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8 lg:py-10">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengaturan Toko</h1>
          <p className="mt-1 text-sm text-muted-foreground">Identitas, kontak, dan jam operasional toko Anda.</p>
        </div>
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Simpan perubahan
        </Button>
      </div>

      {/* Identitas */}
      <Section icon={Store} title="Identitas Toko" desc="Nama, logo, dan deskripsi toko di etalase publik.">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <Label className="mb-2 block">Logo</Label>
            <div className="relative h-32 w-32 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              </Button>
              {form.logo_url && (
                <Button size="sm" variant="outline" onClick={onRemoveLogo}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Maks 2MB</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Nama toko</Label>
              <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                placeholder="Mis. Kopi nikmat, harga sahabat"
                value={form.tagline ?? ""}
                onChange={(e) => update("tagline", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="desc">Deskripsi</Label>
              <Textarea
                id="desc"
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              URL etalase: <code className="rounded bg-muted px-1.5 py-0.5">/s/{form.slug}</code>
            </div>
          </div>
        </div>
      </Section>

      {/* Kontak */}
      <Section icon={Phone} title="Kontak" desc="Cara pelanggan menghubungi toko.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="No. telepon" value={form.phone ?? ""} onChange={(v) => update("phone", v)} placeholder="0812..." />
          <Field label="WhatsApp" value={form.whatsapp ?? ""} onChange={(v) => update("whatsapp", v)} placeholder="62812..." />
          <Field label="Email" value={form.email ?? ""} onChange={(v) => update("email", v)} placeholder="kontak@toko.com" />
          <Field label="Instagram" value={form.instagram ?? ""} onChange={(v) => update("instagram", v)} placeholder="@toko" />
        </div>
      </Section>

      {/* Alamat */}
      <Section icon={MapPin} title="Alamat" desc="Lokasi fisik toko.">
        <Textarea
          rows={2}
          value={form.address ?? ""}
          onChange={(e) => update("address", e.target.value)}
          placeholder="Jl. Contoh No. 123, Kota..."
        />
      </Section>

      {/* Jam operasional */}
      <Section icon={Clock} title="Jam Operasional" desc="Atur jam buka per hari.">
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const h = (form.open_hours ?? DEFAULT_HOURS)[key];
            return (
              <div key={key} className="grid grid-cols-[80px_1fr_auto_1fr_auto] items-center gap-2 sm:gap-3">
                <span className="text-sm font-medium">{label}</span>
                <Input
                  type="time"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => updateHour(key, { open: e.target.value })}
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={h.close}
                  disabled={h.closed}
                  onChange={(e) => updateHour(key, { close: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch
                    checked={!h.closed}
                    onCheckedChange={(v) => updateHour(key, { closed: !v })}
                  />
                  <span className="text-muted-foreground">{h.closed ? "Tutup" : "Buka"}</span>
                </label>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Pembayaran */}
      <Section icon={CreditCard} title="Pembayaran" desc="Metode pembayaran yang ditawarkan ke pelanggan online.">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {(["cash", "qris", "transfer"] as PaymentMethod[]).map((m) => {
              const active = (form.payment_methods_enabled ?? []).includes(m);
              const labels: Record<PaymentMethod, string> = {
                cash: "Cash di tempat",
                qris: "QRIS (statis)",
                transfer: "Transfer bank",
              };
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => togglePayment(m)}
                  className={`rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${
                    active ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{labels[m]}</span>
                    {active && <span className="text-primary text-xs">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {(form.payment_methods_enabled ?? []).includes("qris") && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-2 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">QRIS statis</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Upload gambar QR code statis dari merchant Anda. Pelanggan akan scan & upload bukti bayar untuk verifikasi manual.
              </p>
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <div>
                  <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-dashed border-border bg-background flex items-center justify-center">
                    {form.qris_image_url ? (
                      <img src={form.qris_image_url} alt="QRIS" className="h-full w-full object-contain" />
                    ) : (
                      <QrCode className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={uploadingQris}
                      onClick={() => qrisFileRef.current?.click()}
                    >
                      {uploadingQris ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                    {form.qris_image_url && (
                      <Button size="sm" variant="outline" onClick={() => update("qris_image_url", null)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <input
                      ref={qrisFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadQris(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label>Nama merchant</Label>
                    <Input
                      placeholder="Mis. Toko Kopi Sahabat"
                      value={form.qris_merchant_name ?? ""}
                      onChange={(e) => update("qris_merchant_name", e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Tampil di halaman pembayaran pelanggan.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Share */}
      <Section icon={Share2} title="Bagikan etalase" desc="Salin link untuk dibagikan ke pelanggan.">
        <div className="flex gap-2">
          <Input
            readOnly
            value={typeof window !== "undefined" ? `${window.location.origin}/s/${form.slug}` : `/s/${form.slug}`}
          />
          <Button
            variant="outline"
            onClick={() => {
              const url = `${window.location.origin}/s/${form.slug}`;
              navigator.clipboard.writeText(url);
              toast.success("Link disalin");
            }}
          >
            Salin
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
