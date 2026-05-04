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
import { Loader2, Plus, Pencil, Trash2, Package, AlertTriangle, ArrowDownUp, ClipboardCheck, ListChecks, ShoppingCart, Search } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { LowStockDialog } from "@/components/inventory/low-stock-dialog";

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
  category: string | null;
  default_supplier_id: string | null;
};

type Movement = {
  id: string;
  type: "purchase" | "adjustment" | "sale" | "waste";
  quantity: number;
  note: string | null;
  created_at: string;
  ingredient_id: string;
};

type SupplierOpt = { id: string; name: string };

const NO_SUPPLIER = "__none__";
const NO_CATEGORY = "__none_cat__";
const ING_CATEGORIES = ["Coffee", "Dairy", "Syrup", "Tea", "Food", "Packaging", "Other"];

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
  const [category, setCategory] = useState<string>(NO_CATEGORY);
  const [defaultSupplier, setDefaultSupplier] = useState<string>(NO_SUPPLIER);
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
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

  // bulk opname
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkOnlyChanged, setBulkOnlyChanged] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // opname history
  const [historyOpen, setHistoryOpen] = useState(false);
  const [opnames, setOpnames] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // price history
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [priceHistoryTarget, setPriceHistoryTarget] = useState<Ingredient | null>(null);

  // low-stock dialog
  const [lowOpen, setLowOpen] = useState(false);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const [ing, mv, sup] = await Promise.all([
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
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("name"),
    ]);
    if (ing.error) toast.error(ing.error.message);
    const ingredients = (ing.data ?? []) as Ingredient[];
    setItems(ingredients);
    setMovements((mv.data ?? []) as Movement[]);
    setSuppliers((sup.data ?? []) as SupplierOpt[]);
    setLoading(false);

    // Alert low stock
    const low = ingredients.filter((i) => i.current_stock <= i.min_stock && i.min_stock > 0);
    if (low.length > 0) {
      toast.warning(`${low.length} bahan baku menipis!`, {
        description: "Segera lakukan pembelian stok.",
        action: {
          label: "Lihat",
          onClick: () => setLowOpen(true),
        },
      });
    }
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
    setCategory(NO_CATEGORY);
    setDefaultSupplier(NO_SUPPLIER);
    setOpen(true);
  }

  function openEdit(i: Ingredient) {
    setEditing(i);
    setName(i.name);
    setUnit(i.unit);
    setMinStock(String(i.min_stock));
    setCost(String(i.cost_per_unit));
    setCategory(i.category ?? NO_CATEGORY);
    setDefaultSupplier(i.default_supplier_id ?? NO_SUPPLIER);
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
      category: category === NO_CATEGORY ? null : category,
      default_supplier_id: defaultSupplier === NO_SUPPLIER ? null : defaultSupplier,
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

    const { data: opname, error: opErr } = await (supabase as any).from("stock_opnames").insert({
      shop_id: shop.id,
      notes: opnameNote.trim() || "Opname tunggal",
      status: "completed",
    }).select("id").single();

    if (opErr) { toast.error(opErr.message); setOpnameSaving(false); return; }

    await (supabase as any).from("stock_opname_items").insert({
      stock_opname_id: opname.id,
      ingredient_id: opnameTarget.id,
      system_stock: opnameTarget.current_stock,
      actual_stock: actual,
      adjustment: delta,
      notes: opnameNote.trim() || null,
    });

    const note = `Opname: aktual ${actual} ${opnameTarget.unit}` + (opnameNote.trim() ? ` — ${opnameNote.trim()}` : "");
    if (delta > 0) {
      await supabase.from("stock_movements").insert({
        shop_id: shop.id, ingredient_id: opnameTarget.id,
        type: "adjustment", quantity: delta, note,
      });
    } else {
      await supabase.from("stock_movements").insert({
        shop_id: shop.id, ingredient_id: opnameTarget.id,
        type: "waste", quantity: Math.abs(delta), note,
      });
    }

    toast.success(`Opname tersimpan (${delta > 0 ? "+" : ""}${delta})`);
    setOpnameOpen(false);
    setOpnameSaving(false);
    load();
  }

  function openBulkOpname() {
    const init: Record<string, string> = {};
    items.forEach((i) => { init[i.id] = String(i.current_stock); });
    setBulkValues(init);
    setBulkNote("");
    setBulkSearch("");
    setBulkOnlyChanged(false);
    setBulkOpen(true);
  }

  async function saveBulkOpname() {
    if (!shop) return;
    const movements: any[] = [];
    const opnameItems: any[] = [];
    let totalDeltaValue = 0;
    let adjusted = 0;
    const today = new Date().toLocaleDateString("id-ID");

    for (const i of items) {
      const raw = bulkValues[i.id];
      if (raw === undefined || raw === "") continue;
      const actual = Number(raw);
      if (Number.isNaN(actual) || actual < 0) {
        toast.error(`Stok aktual untuk "${i.name}" tidak valid`);
        return;
      }
      const delta = actual - Number(i.current_stock);
      if (delta === 0) continue;
      adjusted += 1;
      totalDeltaValue += delta * Number(i.cost_per_unit);
      const note = `Opname ${today}: sistem ${i.current_stock} → aktual ${actual} ${i.unit}` + (bulkNote.trim() ? ` — ${bulkNote.trim()}` : "");
      
      opnameItems.push({
        ingredient_id: i.id,
        system_stock: i.current_stock,
        actual_stock: actual,
        adjustment: delta,
      });

      if (delta > 0) {
        movements.push({ shop_id: shop.id, ingredient_id: i.id, type: "adjustment", quantity: delta, note });
      } else {
        movements.push({ shop_id: shop.id, ingredient_id: i.id, type: "waste", quantity: Math.abs(delta), note });
      }
    }

    if (movements.length === 0) { toast.info("Tidak ada selisih untuk disimpan"); return; }
    setBulkSaving(true);

    const { data: opname, error: opErr } = await (supabase as any).from("stock_opnames").insert({
      shop_id: shop.id,
      notes: bulkNote.trim() || `Opname massal ${today}`,
      status: "completed",
    }).select("id").single();

    if (opErr) { toast.error(opErr.message); setBulkSaving(false); return; }

    await (supabase as any).from("stock_opname_items").insert(
      opnameItems.map(oi => ({ ...oi, stock_opname_id: opname.id }))
    );

    const { error } = await supabase.from("stock_movements").insert(movements);
    setBulkSaving(false);
    if (error) { toast.error(error.message); return; }
    
    toast.success(`Opname tersimpan: ${adjusted} bahan disesuaikan (${totalDeltaValue >= 0 ? "+" : ""}${formatIDR(totalDeltaValue)})`);
    setBulkOpen(false);
    load();
  }

  async function loadOpnameHistory() {
    if (!shop) return;
    setHistoryLoading(true);
    setHistoryOpen(true);
    const { data, error } = await (supabase as any)
      .from("stock_opnames")
      .select("*, stock_opname_items(*, ingredients(name, unit))")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) toast.error(error.message);
    else setOpnames(data || []);
    setHistoryLoading(false);
  }

  async function loadPriceHistory(i: Ingredient) {
    if (!shop) return;
    setPriceHistoryTarget(i);
    setPriceHistoryLoading(true);
    setPriceHistoryOpen(true);
    const { data, error } = await supabase
      .from("stock_movements")
      .select("created_at, unit_cost, quantity, note")
      .eq("ingredient_id", i.id)
      .eq("type", "purchase")
      .not("unit_cost", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) toast.error(error.message);
    else setPriceHistory(data || []);
    setPriceHistoryLoading(false);
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
        <div className="flex flex-wrap items-center gap-2">
          {lowStock.length > 0 && (
            <Button variant="outline" onClick={() => setLowOpen(true)}>
              <ShoppingCart className="mr-1.5 h-4 w-4" /> Pesan stok ({lowStock.length})
            </Button>
          )}
          <Button variant="outline" onClick={loadOpnameHistory}>
            <ClipboardCheck className="mr-1.5 h-4 w-4" /> Riwayat Opname
          </Button>
          <Button variant="outline" onClick={openBulkOpname} disabled={items.length === 0}>
            <ListChecks className="mr-1.5 h-4 w-4" /> Opname Massal
          </Button>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>— tanpa kategori —</SelectItem>
                      {ING_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Supplier default</Label>
                  <Select value={defaultSupplier} onValueChange={setDefaultSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder={suppliers.length === 0 ? "Belum ada supplier" : "Pilih supplier"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUPPLIER}>— tidak ada —</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <button 
                        onClick={() => loadPriceHistory(i)}
                        className="hover:text-primary hover:underline underline-offset-4"
                      >
                        {formatIDR(i.cost_per_unit)}
                      </button>
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

      <Dialog open={opnameOpen} onOpenChange={setOpnameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stok Opname — {opnameTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted/30 px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Stok sistem</span>
                <span className="tabular-nums font-medium">{opnameTarget?.current_stock} {opnameTarget?.unit}</span></div>
              {opnameActual !== "" && !Number.isNaN(Number(opnameActual)) && opnameTarget && (
                <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Selisih</span>
                  <span className={`tabular-nums font-semibold ${Number(opnameActual) - opnameTarget.current_stock < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {Number(opnameActual) - opnameTarget.current_stock > 0 ? "+" : ""}{Number(opnameActual) - opnameTarget.current_stock} {opnameTarget.unit}
                  </span></div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Stok aktual hasil hitung fisik ({opnameTarget?.unit})</Label>
              <Input type="number" value={opnameActual} onChange={(e) => setOpnameActual(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input value={opnameNote} onChange={(e) => setOpnameNote(e.target.value)} placeholder="Mis. Opname akhir bulan" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpnameOpen(false)}>Batal</Button>
            <Button onClick={saveOpname} disabled={opnameSaving}>
              {opnameSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Stok Opname Massal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Cari bahan..." value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={bulkOnlyChanged} onChange={(e) => setBulkOnlyChanged(e.target.checked)} />
                Hanya yang berubah
              </label>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Bahan</th>
                    <th className="px-3 py-2 text-right">Sistem</th>
                    <th className="px-3 py-2 text-right">Aktual</th>
                    <th className="px-3 py-2 text-right">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items
                    .filter((i) => i.name.toLowerCase().includes(bulkSearch.toLowerCase()))
                    .filter((i) => {
                      if (!bulkOnlyChanged) return true;
                      const v = bulkValues[i.id];
                      return v !== undefined && v !== "" && Number(v) !== Number(i.current_stock);
                    })
                    .map((i) => {
                      const raw = bulkValues[i.id] ?? "";
                      const actual = raw === "" ? null : Number(raw);
                      const delta = actual !== null && !Number.isNaN(actual) ? actual - Number(i.current_stock) : 0;
                      const invalid = raw !== "" && (Number.isNaN(actual!) || (actual ?? 0) < 0);
                      return (
                        <tr key={i.id}>
                          <td className="px-3 py-2 font-medium">{i.name} <span className="text-xs text-muted-foreground">({i.unit})</span></td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.current_stock}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number" min="0" step="0.01"
                              className={`h-8 w-24 ml-auto text-right tabular-nums ${invalid ? "border-destructive" : ""}`}
                              value={raw}
                              onChange={(e) => setBulkValues((m) => ({ ...m, [i.id]: e.target.value }))}
                            />
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums font-semibold ${delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5">
              <Label>Catatan opname (opsional)</Label>
              <Input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Mis. Opname akhir bulan April" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Batal</Button>
            <Button onClick={saveBulkOpname} disabled={bulkSaving}>
              {bulkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan Opname
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Stok Opname</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : opnames.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Belum ada riwayat opname.</div>
          ) : (
            <div className="space-y-6">
              {opnames.map((op) => (
                <div key={op.id} className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 flex justify-between items-center border-b border-border">
                    <div>
                      <div className="text-sm font-semibold">
                        {new Date(op.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                      <div className="text-xs text-muted-foreground">{op.notes || "Tanpa catatan"}</div>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700 uppercase">
                      {op.status}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/10 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Bahan</th>
                        <th className="px-4 py-2 text-right">Sistem</th>
                        <th className="px-4 py-2 text-right">Aktual</th>
                        <th className="px-4 py-2 text-right">Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {op.stock_opname_items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 font-medium">{item.ingredients?.name}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{item.system_stock} {item.ingredients?.unit}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">{item.actual_stock} {item.ingredients?.unit}</td>
                          <td className={`px-4 py-2 text-right tabular-nums font-semibold ${item.adjustment === 0 ? "text-muted-foreground" : item.adjustment > 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {item.adjustment > 0 ? "+" : ""}{item.adjustment}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHistoryOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceHistoryOpen} onOpenChange={setPriceHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Riwayat Harga Beli — {priceHistoryTarget?.name}</DialogTitle>
          </DialogHeader>
          {priceHistoryLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : priceHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Belum ada riwayat pembelian untuk bahan ini.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Tanggal</th>
                    <th className="px-4 py-2 text-right">Harga / unit</th>
                    <th className="px-4 py-2 text-right">Jumlah</th>
                    <th className="px-4 py-2 text-left">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {priceHistory.map((h, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
                        {new Date(h.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{formatIDR(h.unit_cost)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{h.quantity} {priceHistoryTarget?.unit}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{h.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPriceHistoryOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LowStockDialog open={lowOpen} onOpenChange={setLowOpen} shopId={shop?.id ?? null} />
    </div>
  );
}
