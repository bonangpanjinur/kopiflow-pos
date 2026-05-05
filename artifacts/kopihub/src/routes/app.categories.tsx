import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Tags, ChefHat, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/categories")({
  component: CategoriesPage,
});

type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  kds_station: string | null;
  printer_id: string | null;
};

type Printer = {
  id: string;
  name: string;
};

function CategoriesPage() {
  const { shop, outlet, loading: shopLoading } = useCurrentShop();
  const [items, setItems] = useState<Category[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [kdsStation, setKdsStation] = useState("general");
  const [printerId, setPrinterId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, sort_order, is_active, kds_station, printer_id")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems(data ?? []);

    if (outlet) {
      const { data: pData } = await supabase
        .from("printers")
        .select("id, name")
        .eq("outlet_id", outlet.id);
      setPrinters(pData ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
  }, [shop?.id, outlet?.id]);

  function openNew() {
    setEditing(null);
    setName("");
    setActive(true);
    setKdsStation("general");
    setPrinterId("none");
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setActive(c.is_active);
    setKdsStation(c.kds_station || "general");
    setPrinterId(c.printer_id || "none");
    setOpen(true);
  }

  async function save() {
    if (!shop || !name.trim()) return;
    setSaving(true);
    const payload = { 
      name: name.trim(), 
      is_active: active,
      kds_station: kdsStation,
      printer_id: printerId === "none" ? null : printerId
    };

    if (editing) {
      const { error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Kategori diperbarui");
    } else {
      const nextOrder = (items[items.length - 1]?.sort_order ?? 0) + 10;
      const { error } = await supabase.from("categories").insert({
        ...payload,
        shop_id: shop.id,
        sort_order: nextOrder,
      });
      if (error) toast.error(error.message);
      else toast.success("Kategori dibuat");
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function remove(c: Category) {
    if (!confirm(`Hapus kategori "${c.name}"? Menu di dalamnya tidak ikut terhapus.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Kategori dihapus");
      load();
    }
  }

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kategori</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelompokkan menu Anda agar mudah dicari di POS dan etalase.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Kategori baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit kategori" : "Kategori baru"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Nama</Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mis. Kopi, Non-kopi, Pastry"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <ChefHat className="h-3.5 w-3.5" /> Stasiun KDS
                  </Label>
                  <Select value={kdsStation} onValueChange={setKdsStation}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="kitchen">Kitchen (Dapur)</SelectItem>
                      <SelectItem value="bar">Bar (Minuman)</SelectItem>
                      <SelectItem value="bakery">Bakery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Printer className="h-3.5 w-3.5" /> Printer Rute
                  </Label>
                  <Select value={printerId} onValueChange={setPrinterId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default (Kasir)</SelectItem>
                      {printers.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Aktif</div>
                  <div className="text-xs text-muted-foreground">
                    Hanya kategori aktif yang muncul.
                  </div>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={save} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Tags className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Belum ada kategori</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Buat kategori pertama Anda untuk menata menu.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      c.is_active ? "bg-primary" : "bg-muted-foreground/40"
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1 rounded font-semibold">
                        {c.kds_station || "general"}
                      </span>
                      {c.printer_id && (
                        <span className="text-[10px] text-blue-600 uppercase bg-blue-50 px-1 rounded font-semibold border border-blue-100">
                          Routed
                        </span>
                      )}
                    </div>
                  </div>
                  {!c.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Nonaktif
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(c)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
