import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/delivery")({
  component: DeliveryPage,
});

type Settings = {
  shop_id: string;
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

type Zone = {
  id: string;
  shop_id: string;
  name: string;
  fee: number;
  area_note: string | null;
  is_active: boolean;
  sort_order: number;
};

const DEFAULTS: Omit<Settings, "shop_id"> = {
  mode: "flat",
  base_fee: 5000,
  free_above: null,
  min_order: 0,
  pickup_enabled: true,
  delivery_enabled: true,
  open_time: null,
  close_time: null,
  notes: null,
};

function DeliveryPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shop) return;
    (async () => {
      const [{ data: s }, { data: z }] = await Promise.all([
        supabase.from("delivery_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
        supabase
          .from("delivery_zones")
          .select("*")
          .eq("shop_id", shop.id)
          .order("sort_order"),
      ]);
      setSettings(
        s
          ? (s as Settings)
          : { shop_id: shop.id, ...DEFAULTS },
      );
      setZones((z ?? []) as Zone[]);
    })();
  }, [shop]);

  async function saveSettings() {
    if (!settings || !shop) return;
    setSaving(true);
    const { error } = await supabase
      .from("delivery_settings")
      .upsert({ ...settings, shop_id: shop.id }, { onConflict: "shop_id" });
    setSaving(false);
    if (error) toast.error("Gagal menyimpan");
    else toast.success("Pengaturan disimpan");
  }

  async function addZone() {
    if (!shop) return;
    const { data, error } = await supabase
      .from("delivery_zones")
      .insert({ shop_id: shop.id, name: "Zona baru", fee: 5000, sort_order: zones.length })
      .select()
      .single();
    if (error || !data) return toast.error("Gagal");
    setZones([...zones, data as Zone]);
  }

  async function updateZone(id: string, patch: Partial<Zone>) {
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    const { error } = await supabase.from("delivery_zones").update(patch).eq("id", id);
    if (error) toast.error("Gagal update zona");
  }

  async function deleteZone(id: string) {
    if (!confirm("Hapus zona ini?")) return;
    const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
    if (error) return toast.error("Gagal hapus");
    setZones((zs) => zs.filter((z) => z.id !== id));
  }

  if (shopLoading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengaturan Delivery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur ongkir, minimum order, dan jam delivery untuk etalase publik.
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="gap-1">
          <Save className="h-4 w-4" /> {saving ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Mode & ongkir</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Aktifkan Pickup</p>
              <p className="text-xs text-muted-foreground">Ambil di toko</p>
            </div>
            <Switch
              checked={settings.pickup_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, pickup_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Aktifkan Delivery</p>
              <p className="text-xs text-muted-foreground">Antar ke alamat pelanggan</p>
            </div>
            <Switch
              checked={settings.delivery_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, delivery_enabled: v })}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Mode ongkir</Label>
          <RadioGroup
            value={settings.mode}
            onValueChange={(v) => setSettings({ ...settings, mode: v as "flat" | "zone" })}
            className="mt-1 grid grid-cols-2 gap-2"
          >
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${settings.mode === "flat" ? "border-primary bg-accent" : "border-border"}`}>
              <RadioGroupItem value="flat" />
              <div>
                <p className="text-sm font-medium">Flat</p>
                <p className="text-xs text-muted-foreground">1 tarif untuk semua alamat</p>
              </div>
            </label>
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${settings.mode === "zone" ? "border-primary bg-accent" : "border-border"}`}>
              <RadioGroupItem value="zone" />
              <div>
                <p className="text-sm font-medium">Per zona</p>
                <p className="text-xs text-muted-foreground">Tarif berbeda per area</p>
              </div>
            </label>
          </RadioGroup>
        </div>

        {settings.mode === "flat" && (
          <div className="space-y-1">
            <Label className="text-xs">Tarif flat (Rp)</Label>
            <Input
              type="number"
              value={settings.base_fee}
              onChange={(e) => setSettings({ ...settings, base_fee: Number(e.target.value) || 0 })}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Minimum order (Rp)</Label>
            <Input
              type="number"
              value={settings.min_order}
              onChange={(e) => setSettings({ ...settings, min_order: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gratis ongkir di atas (Rp, kosongkan untuk nonaktif)</Label>
            <Input
              type="number"
              value={settings.free_above ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  free_above: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Jam buka delivery</Label>
            <Input
              type="time"
              value={settings.open_time ?? ""}
              onChange={(e) => setSettings({ ...settings, open_time: e.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Jam tutup delivery</Label>
            <Input
              type="time"
              value={settings.close_time ?? ""}
              onChange={(e) => setSettings({ ...settings, close_time: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Catatan untuk pelanggan</Label>
          <Textarea
            value={settings.notes ?? ""}
            onChange={(e) => setSettings({ ...settings, notes: e.target.value || null })}
            rows={2}
            placeholder="Mis. estimasi 30-60 menit, hari Minggu libur, dll."
          />
        </div>
      </section>

      {settings.mode === "zone" && (
        <section className="mt-6 space-y-3 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Zona pengiriman</h2>
            <Button size="sm" variant="outline" onClick={addZone} className="gap-1">
              <Plus className="h-4 w-4" /> Tambah zona
            </Button>
          </div>

          {zones.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada zona. Tambahkan minimal 1 zona supaya pelanggan bisa checkout delivery.
            </p>
          )}

          <div className="space-y-2">
            {zones.map((z) => (
              <div key={z.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_140px_1fr_auto_auto]">
                <Input
                  value={z.name}
                  placeholder="Nama zona"
                  onChange={(e) => updateZone(z.id, { name: e.target.value })}
                />
                <Input
                  type="number"
                  value={z.fee}
                  placeholder="Fee"
                  onChange={(e) => updateZone(z.id, { fee: Number(e.target.value) || 0 })}
                />
                <Input
                  value={z.area_note ?? ""}
                  placeholder="Catatan area (mis. radius < 3 km)"
                  onChange={(e) => updateZone(z.id, { area_note: e.target.value || null })}
                />
                <div className="flex items-center gap-2 px-1">
                  <Switch
                    checked={z.is_active}
                    onCheckedChange={(v) => updateZone(z.id, { is_active: v })}
                  />
                  <span className="text-xs text-muted-foreground">{z.is_active ? "Aktif" : "Off"}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteZone(z.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Contoh fee: {formatIDR(5000)} / {formatIDR(10000)} / {formatIDR(15000)} per zona.
          </p>
        </section>
      )}
    </div>
  );
}
