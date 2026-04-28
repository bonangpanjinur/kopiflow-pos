import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Package, AlertTriangle, ArrowDownUp, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/inventory")({
  component: InventoryPage,
});

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  is_active: boolean;
};

type Movement = {
  id: string;
  type: "purchase" | "adjustment" | "sale" | "waste";
  quantity: number;
  note: string | null;
  created_at: string;
  ingredient_id: string;
};

const UNITS = ["pcs", "g", "kg", "ml", "L", "shot", "scoop"];

function InventoryPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [minStock, setMinStock] = useState("0");
  const [cost, setCost] = useState("0");
  const [saving, setSaving] = useState(false);

  // movement modal
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Ingredient | null>(null);
  const [moveType, setMoveType] = useState<"purchase" | "adjustment" | "waste">("purchase");
  const [moveQty, setMoveQty] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);

  // opname modal
  const [opnameOpen, setOpnameOpen] = useState(false);
  const [opnameTarget, setOpnameTarget] = useState<Ingredient | null>(null);
  const [opnameActual, setOpnameActual] = useState("");
  const [opnameNote, setOpnameNote] = useState("");
  const [opnameSaving, setOpnameSaving] = useState(false);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const [ing, mv] = await Promise.all([
      supabase
        .from("ingredients")
        .select("*")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("stock_movements")
        .select("id, type, quantity, note, created_at, ingredient_id")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (ing.error) toast.error(ing.error.message);
    setItems((ing.data ?? []) as Ingredient[]);
    setMovements((mv.data ?? []) as Movement[]);
    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id]);

  function openNew() {
    setEditing(null);
    setName("");
    setUnit("pcs");
    setMinStock("0");
    setCost("0");
    setOpen(true);
  }

  function openEdit(i: Ingredient) {
    setEditing(i);
    setName(i.name);
    setUnit(i.unit);
    setMinStock(String(i.min_stock));
    setCost(String(i.cost_per_unit));
    setOpen(true);
  }

  async function save() {
    if (!shop || !name.trim()) return;
    setSaving(true);
    const payload = {
      shop_id: shop.id,
      name: name.trim(),
      unit,
      min_stock: Number(minStock) || 0,
      cost_per_unit: Number(cost) || 0,
    };
    if (editing) {
      const { error } = await supabase.from("ingredients").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Bahan diperbarui");
    } else {
      const { error } = await supabase.from("ingredients").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Bahan ditambahkan");
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function remove(i: Ingredient) {
    if (!confirm(`Nonaktifkan "${i.name}"? Riwayat tetap tersimpan.`)) return;
    const { error } = await supabase.from("ingredients").update({ is_active: false }).eq("id", i.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Bahan dinonaktifkan");
      load();
    }
  }

  function openMove(i: Ingredient) {
    setMoveTarget(i);
    setMoveType("purchase");
    setMoveQty("");
    setMoveNote("");
    setMoveOpen(true);
  }

  async function saveMovement() {
    if (!moveTarget || !shop) return;
    const qty = Number(moveQty);
    if (!qty || qty <= 0) {
      toast.error("Jumlah tidak valid");
      return;
    }
    setMoveSaving(true);
    const { error } = await supabase.from("stock_movements").insert({
      shop_id: shop.id,
      ingredient_id: moveTarget.id,
      type: moveType,
      quantity: qty,
      note: moveNote.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Pergerakan stok dicatat");
      setMoveOpen(false);
      load();
    }
    setMoveSaving(false);
  }

  function openOpname(i: Ingredient) {
    setOpnameTarget(i);
    setOpnameActual(String(i.current_stock));
    setOpnameNote("");
    setOpnameOpen(true);
  }

  async function saveOpname() {
    if (!opnameTarget || !shop) return;
    const actual = Number(opnameActual);
    if (Number.isNaN(actual) || actual < 0) { toast.error("Stok aktual tidak valid"); return; }
    const delta = actual - opnameTarget.current_stock;
    if (delta === 0) { toast.info("Tidak ada selisih"); setOpnameOpen(false); return; }
    setOpnameSaving(true);
    const note = `Opname: aktual ${actual} ${opnameTarget.unit}` + (opnameNote.trim() ? ` — ${opnameNote.trim()}` : "");
    if (delta > 0) {
      const { error } = await supabase.from("stock_movements").insert({
        shop_id: shop.id, ingredient_id: opnameTarget.id,
        type: "adjustment", quantity: delta, note,
      });
      if (error) { toast.error(error.message); setOpnameSaving(false); return; }
    } else {
      const { error } = await supabase.from("stock_movements").insert({
        shop_id: shop.id, ingredient_id: opnameTarget.id,
        type: "waste", quantity: Math.abs(delta), note,
      });
      if (error) { toast.error(error.message); setOpnameSaving(false); return; }
    }
    toast.success(`Opname tersimpan (${delta > 0 ? "+" : ""}${delta})`);
    setOpnameOpen(false);
    setOpnameSaving(false);
    load();
  }

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lowStock = items.filter((i) => i.current_stock <= i.min_stock && i.min_stock > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventori</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola bahan baku. Stok berkurang otomatis saat menu yang punya resep terjual.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Bahan baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit bahan" : "Bahan baru"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mis. Susu UHT" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Satuan</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stok min</Label>
                  <Input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Harga / unit</Label>
                  <Input
                    type="number"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>
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

      {lowStock.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
          <div>
            <span className="font-medium">{lowStock.length} bahan</span> berada di bawah stok minimum:{" "}
            <span className="text-muted-foreground">
              {lowStock.map((i) => i.name).join(", ")}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Belum ada bahan</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Tambahkan bahan baku — biji kopi, susu, sirup, kemasan. Lalu hubungkan ke menu di tab Resep.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Nama</th>
                <th className="px-4 py-2.5 text-right">Stok</th>
                <th className="px-4 py-2.5 text-right">Min</th>
                <th className="px-4 py-2.5 text-right">Harga / unit</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((i) => {
                const low = i.current_stock <= i.min_stock && i.min_stock > 0;
                return (
                  <tr key={i.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{i.name}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${low ? "text-amber-600 font-semibold" : ""}`}>
                      {i.current_stock} {i.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {i.min_stock}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatIDR(i.cost_per_unit)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openOpname(i)}>
                          <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Opname
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openMove(i)}>
                          <ArrowDownUp className="mr-1.5 h-3.5 w-3.5" /> Stok
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(i)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {movements.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Riwayat Pergerakan (30 terakhir)</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Waktu</th>
                  <th className="px-4 py-2.5 text-left">Bahan</th>
                  <th className="px-4 py-2.5 text-left">Jenis</th>
                  <th className="px-4 py-2.5 text-right">Jumlah</th>
                  <th className="px-4 py-2.5 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => {
                  const ing = items.find((i) => i.id === m.ingredient_id);
                  const sign = m.type === "purchase" || m.type === "adjustment" ? "+" : "−";
                  return (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                        {new Date(m.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-2.5">{ing?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 capitalize text-xs">
                        <span className={
                          m.type === "purchase" ? "text-emerald-600" :
                          m.type === "sale" ? "text-blue-600" :
                          m.type === "waste" ? "text-destructive" :
                          "text-muted-foreground"
                        }>
                          {m.type === "purchase" ? "Pembelian" : m.type === "sale" ? "Penjualan" : m.type === "waste" ? "Susut" : "Penyesuaian"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {sign}{m.quantity} {ing?.unit}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat pergerakan stok — {moveTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Jenis</Label>
              <Select value={moveType} onValueChange={(v) => setMoveType(v as typeof moveType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Pembelian (+)</SelectItem>
                  <SelectItem value="adjustment">Penyesuaian (+)</SelectItem>
                  <SelectItem value="waste">Susut/Buang (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah ({moveTarget?.unit})</Label>
              <Input
                type="number"
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
                placeholder="Mis. Beli di pasar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>Batal</Button>
            <Button onClick={saveMovement} disabled={moveSaving}>
              {moveSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
