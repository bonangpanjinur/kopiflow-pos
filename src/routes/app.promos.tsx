import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/promos")({
  component: PromosPage,
});

type Promo = {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "nominal";
  value: number;
  min_order: number;
  max_discount: number | null;
  channel: "pos" | "online" | "all";
  usage_limit: number | null;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
};

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Min 2 karakter")
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, "Hanya huruf/angka/_/-"),
  description: z.string().max(200).optional().nullable(),
  type: z.enum(["percent", "nominal"]),
  value: z.coerce.number().min(0),
  min_order: z.coerce.number().min(0),
  max_discount: z.coerce.number().min(0).optional().nullable(),
  channel: z.enum(["pos", "online", "all"]),
  usage_limit: z.coerce.number().int().min(0).optional().nullable(),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_active: z.boolean(),
});

function PromosPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const { data } = await supabase
      .from("promos")
      .select("*")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false });
    setPromos((data ?? []) as Promo[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!shopLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, shopLoading]);

  async function toggleActive(p: Promo) {
    const { error } = await supabase
      .from("promos")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    setPromos((xs) => xs.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
  }

  async function remove(p: Promo) {
    if (!confirm(`Hapus promo ${p.code}?`)) return;
    const { error } = await supabase.from("promos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    setPromos((xs) => xs.filter((x) => x.id !== p.id));
    toast.success("Promo dihapus");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Promo & Diskon</h1>
          <p className="text-sm text-muted-foreground">
            Buat kode promo untuk POS dan marketplace.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Tambah promo
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : promos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <TicketPercent className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Belum ada promo. Buat kode pertamamu!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {promos.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-semibold">{p.code}</span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs">
                    {p.type === "percent" ? `${p.value}%` : formatIDR(p.value)}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase">
                    {p.channel}
                  </span>
                  {!p.is_active && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      nonaktif
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Min {formatIDR(p.min_order)} · Terpakai {p.usage_count}
                  {p.usage_limit ? `/${p.usage_limit}` : ""}
                  {p.expires_at ? ` · Expired ${new Date(p.expires_at).toLocaleDateString("id-ID")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && shop && (
        <PromoDialog
          shopId={shop.id}
          editing={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function PromoDialog({
  shopId,
  editing,
  onClose,
  onSaved,
}: {
  shopId: string;
  editing: Promo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: editing?.code ?? "",
    description: editing?.description ?? "",
    type: (editing?.type ?? "percent") as "percent" | "nominal",
    value: String(editing?.value ?? 10),
    min_order: String(editing?.min_order ?? 0),
    max_discount: editing?.max_discount != null ? String(editing.max_discount) : "",
    channel: (editing?.channel ?? "all") as "pos" | "online" | "all",
    usage_limit: editing?.usage_limit != null ? String(editing.usage_limit) : "",
    starts_at: editing?.starts_at ? editing.starts_at.slice(0, 16) : "",
    expires_at: editing?.expires_at ? editing.expires_at.slice(0, 16) : "",
    is_active: editing?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = schema.safeParse({
      ...form,
      max_discount: form.max_discount === "" ? null : form.max_discount,
      usage_limit: form.usage_limit === "" ? null : form.usage_limit,
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
      description: form.description || null,
    });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0].message);
    }
    setSaving(true);
    const payload = {
      shop_id: shopId,
      code: parsed.data.code.toUpperCase(),
      description: parsed.data.description,
      type: parsed.data.type,
      value: parsed.data.value,
      min_order: parsed.data.min_order,
      max_discount: parsed.data.max_discount,
      channel: parsed.data.channel,
      usage_limit: parsed.data.usage_limit,
      starts_at: parsed.data.starts_at ? new Date(parsed.data.starts_at).toISOString() : null,
      expires_at: parsed.data.expires_at ? new Date(parsed.data.expires_at).toISOString() : null,
      is_active: parsed.data.is_active,
    };
    const { error } = editing
      ? await supabase.from("promos").update(payload).eq("id", editing.id)
      : await supabase.from("promos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tersimpan");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit promo" : "Tambah promo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Kode</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="HEMAT10"
              />
            </div>
            <div>
              <Label className="text-xs">Channel</Label>
              <Select
                value={form.channel}
                onValueChange={(v) => setForm({ ...form, channel: v as typeof form.channel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="pos">POS saja</SelectItem>
                  <SelectItem value="online">Online saja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Deskripsi (opsional)</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Jenis</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as typeof form.type })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Persen (%)</SelectItem>
                  <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">
                Nilai {form.type === "percent" ? "(0-100)" : "(Rp)"}
              </Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min order (Rp)</Label>
              <Input
                type="number"
                value={form.min_order}
                onChange={(e) => setForm({ ...form, min_order: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Max diskon (Rp, opsional)</Label>
              <Input
                type="number"
                value={form.max_discount}
                onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                placeholder="Tanpa batas"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Kuota</Label>
              <Input
                type="number"
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <Label className="text-xs">Mulai</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Berakhir</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
            <Label className="text-sm">Aktif</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
