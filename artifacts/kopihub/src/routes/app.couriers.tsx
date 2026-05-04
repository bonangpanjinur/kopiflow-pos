import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Bike, Phone, TrendingUp } from "lucide-react";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/couriers")({
  component: CouriersPage,
});

type Courier = {
  id: string;
  shop_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  plate_number: string | null;
  is_active: boolean;
  note: string | null;
};

const courierSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
  phone: z
    .string()
    .trim()
    .min(8, "Nomor HP minimal 8 digit")
    .max(20, "Nomor HP maksimal 20 karakter")
    .regex(/^[0-9+\-\s]+$/, "Hanya angka, +, -, dan spasi"),
  plate_number: z
    .string()
    .trim()
    .max(15, "Plat motor maksimal 15 karakter")
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(300, "Catatan maksimal 300 karakter").optional().or(z.literal("")),
});

type FormState = {
  name: string;
  phone: string;
  plate_number: string;
  note: string;
  is_active: boolean;
};

const EMPTY: FormState = { name: "", phone: "", plate_number: "", note: "", is_active: true };

function CouriersPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [stats, setStats] = useState<Record<string, { count: number; fee: number }>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  async function load() {
    if (!shop) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("couriers")
      .select("*")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Gagal memuat kurir");
    const list = (data ?? []) as Courier[];
    setCouriers(list);

    // 7-day stats per courier
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: ords } = await supabase
      .from("orders")
      .select("courier_id, delivery_fee, status")
      .eq("shop_id", shop.id)
      .gte("created_at", since)
      .eq("status", "completed")
      .not("courier_id", "is", null);
    const agg: Record<string, { count: number; fee: number }> = {};
    (ords ?? []).forEach((o) => {
      const id = o.courier_id as string;
      if (!agg[id]) agg[id] = { count: 0, fee: 0 };
      agg[id].count += 1;
      agg[id].fee += Number(o.delivery_fee || 0);
    });
    setStats(agg);
    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setErrors({});
    setOpen(true);
  }

  function openEdit(c: Courier) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      plate_number: c.plate_number ?? "",
      note: c.note ?? "",
      is_active: c.is_active,
    });
    setErrors({});
    setOpen(true);
  }

  async function save() {
    if (!shop) return;
    const parsed = courierSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormState;
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const payload = {
      shop_id: shop.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      plate_number: parsed.data.plate_number || null,
      note: parsed.data.note || null,
      is_active: form.is_active,
    };

    const { error } = editing
      ? await supabase.from("couriers").update(payload).eq("id", editing.id)
      : await supabase.from("couriers").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan");
      return;
    }
    toast.success(editing ? "Kurir diperbarui" : "Kurir ditambahkan");
    setOpen(false);
    load();
  }

  async function toggleActive(c: Courier) {
    const next = !c.is_active;
    setCouriers((cs) => cs.map((x) => (x.id === c.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase
      .from("couriers")
      .update({ is_active: next })
      .eq("id", c.id);
    if (error) {
      toast.error("Gagal mengubah status");
      setCouriers((cs) => cs.map((x) => (x.id === c.id ? { ...x, is_active: !next } : x)));
    } else {
      toast.success(next ? "Kurir diaktifkan" : "Kurir dinonaktifkan");
    }
  }

  async function remove(c: Courier) {
    if (!confirm(`Hapus kurir "${c.name}"?`)) return;
    const { error } = await supabase.from("couriers").delete().eq("id", c.id);
    if (error) { toast.error("Gagal menghapus"); return; }
    toast.success("Kurir dihapus");
    setCouriers((cs) => cs.filter((x) => x.id !== c.id));
  }

  if (shopLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const active = couriers.filter((c) => c.is_active).length;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kurir Toko</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola kurir untuk antar pesanan delivery. {couriers.length} kurir · {active} aktif.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1">
              <Plus className="h-4 w-4" /> Tambah kurir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit kurir" : "Kurir baru"}</DialogTitle>
              <DialogDescription>
                Data kontak dan kendaraan kurir untuk pengiriman.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nama</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={100}
                  placeholder="Nama lengkap"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nomor HP</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  maxLength={20}
                  inputMode="tel"
                  placeholder="08xxxxxxxxxx"
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plat motor</Label>
                <Input
                  value={form.plate_number}
                  onChange={(e) =>
                    setForm({ ...form, plate_number: e.target.value.toUpperCase() })
                  }
                  maxLength={15}
                  placeholder="B 1234 ABC"
                />
                {errors.plate_number && (
                  <p className="text-xs text-destructive">{errors.plate_number}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Catatan</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  maxLength={300}
                  rows={2}
                  placeholder="Mis. shift pagi, area utara, dll."
                />
                {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Aktif</p>
                  <p className="text-xs text-muted-foreground">
                    Kurir nonaktif tidak muncul di daftar penugasan.
                  </p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : couriers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Bike className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Belum ada kurir</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tambahkan kurir pertama untuk mulai mengirim pesanan delivery.
          </p>
          <Button onClick={openNew} size="sm" className="mt-4 gap-1">
            <Plus className="h-4 w-4" /> Tambah kurir
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {couriers.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-card p-4 ${
                c.is_active ? "border-border" : "border-border opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    {!c.is_active && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </p>
                  {c.plate_number && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Bike className="h-3 w-3" /> {c.plate_number}
                    </p>
                  )}
                  {c.note && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{c.note}</p>
                  )}
                </div>
                <Switch
                  checked={c.is_active}
                  onCheckedChange={() => toggleActive(c)}
                  aria-label="Aktif"
                />
              </div>
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                7 hari: <span className="font-semibold text-foreground">{stats[c.id]?.count ?? 0}</span> antar ·{" "}
                <span className="font-semibold text-foreground">{formatIDR(stats[c.id]?.fee ?? 0)}</span> ongkir
              </div>
              <div className="mt-3 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(c)}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
