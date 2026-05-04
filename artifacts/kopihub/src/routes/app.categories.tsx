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
import { Loader2, Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/categories")({
  component: CategoriesPage,
});

type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

function CategoriesPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, sort_order, is_active")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id]);

  function openNew() {
    setEditing(null);
    setName("");
    setActive(true);
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setActive(c.is_active);
    setOpen(true);
  }

  async function save() {
    if (!shop || !name.trim()) return;
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("categories")
        .update({ name: name.trim(), is_active: active })
        .eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Kategori diperbarui");
    } else {
      const nextOrder = (items[items.length - 1]?.sort_order ?? 0) + 10;
      const { error } = await supabase.from("categories").insert({
        shop_id: shop.id,
        name: name.trim(),
        is_active: active,
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
                  <span className="text-sm font-medium">{c.name}</span>
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
