import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/purchase-orders")({ component: POPage });

type Supplier = { id: string; name: string };
type Ingredient = { id: string; name: string; unit: string; cost_per_unit: number };
type PO = {
  id: string; po_no: string; status: "draft" | "ordered" | "received" | "cancelled";
  supplier_id: string | null; order_date: string; expected_date: string | null;
  received_date: string | null; subtotal: number; tax: number; total: number; note: string | null;
};
type Line = { ingredient_id: string; quantity: string; unit_cost: string };

function POPage() {
  const nav = useNavigate();
  const { shop, loading: shopLoading } = useCurrentShop();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [poNo, setPoNo] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [taxStr, setTaxStr] = useState("0");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ingredient_id: "", quantity: "", unit_cost: "" }]);
  const [saving, setSaving] = useState(false);

  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  async function load() {
    if (!shop) return;
    setLoading(true);
    const [sup, ing, list] = await Promise.all([
      supabase.from("suppliers").select("id, name").eq("shop_id", shop.id).eq("is_active", true).order("name"),
      supabase.from("ingredients").select("id, name, unit, cost_per_unit").eq("shop_id", shop.id).eq("is_active", true).order("name"),
      supabase.from("purchase_orders").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setSuppliers((sup.data ?? []) as Supplier[]);
    setIngredients((ing.data ?? []) as Ingredient[]);
    setPos((list.data ?? []) as PO[]);
    setLoading(false);
  }
  useEffect(() => { if (shop) load(); /* eslint-disable-next-line */ }, [shop?.id]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0),
    [lines]
  );
  const tax = Number(taxStr) || 0;
  const total = subtotal + tax;

  function openNew() {
    setSupplierId("");
    setPoNo(`PO-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(Math.random()*900+100)}`);
    setExpectedDate("");
    setTaxStr("0");
    setNote("");
    setLines([{ ingredient_id: "", quantity: "", unit_cost: "" }]);
    setOpen(true);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((arr) => [...arr, { ingredient_id: "", quantity: "", unit_cost: "" }]); }
  function removeLine(i: number) { setLines((arr) => arr.filter((_, idx) => idx !== i)); }

  async function savePO(asOrdered: boolean) {
    if (!shop || !poNo.trim()) return;
    const valid = lines.filter((l) => l.ingredient_id && Number(l.quantity) > 0);
    if (valid.length === 0) { toast.error("Tambahkan minimal 1 item"); return; }
    setSaving(true);
    const { data: poRow, error } = await supabase.from("purchase_orders").insert({
      shop_id: shop.id,
      supplier_id: supplierId || null,
      po_no: poNo.trim(),
      status: asOrdered ? "ordered" : "draft",
      expected_date: expectedDate || null,
      subtotal, tax, total,
      note: note.trim() || null,
    }).select("id").single();
    if (error || !poRow) { toast.error(error?.message ?? "Gagal"); setSaving(false); return; }
    const { error: itErr } = await supabase.from("purchase_order_items").insert(
      valid.map((l) => ({
        po_id: poRow.id,
        ingredient_id: l.ingredient_id,
        quantity: Number(l.quantity),
        unit_cost: Number(l.unit_cost) || 0,
        subtotal: (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0),
      }))
    );
    if (itErr) toast.error(itErr.message);
    else { toast.success("PO disimpan"); setOpen(false); load(); }
    setSaving(false);
  }

  // Load item counts after POs change
  useEffect(() => {
    (async () => {
      if (pos.length === 0) { setItemCounts({}); return; }
      const { data } = await supabase
        .from("purchase_order_items")
        .select("po_id")
        .in("po_id", pos.map((p) => p.id));
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: { po_id: string }) => { counts[r.po_id] = (counts[r.po_id] ?? 0) + 1; });
      setItemCounts(counts);
    })();
  }, [pos]);

  if (shopLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Order</h1>
          <p className="mt-1 text-sm text-muted-foreground">Buat PO ke supplier; saat diterima, stok & HPP otomatis terupdate.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> PO baru</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Purchase Order baru</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>No. PO</Label>
                  <Input value={poNo} onChange={(e) => setPoNo(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                    <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Tanggal kedatangan (opsional)</Label>
                  <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Pajak (Rp)</Label>
                  <Input type="number" value={taxStr} onChange={(e) => setTaxStr(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label>Item</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" /> Tambah baris</Button></div>
                <div className="space-y-2">
                  {lines.map((l, i) => {
                    const ing = ingredients.find((x) => x.id === l.ingredient_id);
                    const sub = (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Select value={l.ingredient_id} onValueChange={(v) => {
                            const ig = ingredients.find((x) => x.id === v);
                            updateLine(i, { ingredient_id: v, unit_cost: l.unit_cost || String(ig?.cost_per_unit ?? "") });
                          }}>
                            <SelectTrigger><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                            <SelectContent>{ingredients.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({g.unit})</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2"><Input type="number" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} /></div>
                        <div className="col-span-3"><Input type="number" placeholder="Harga/unit" value={l.unit_cost} onChange={(e) => updateLine(i, { unit_cost: e.target.value })} /></div>
                        <div className="col-span-1 text-right text-xs text-muted-foreground tabular-nums">{ing?.unit ?? ""}</div>
                        <div className="col-span-1 flex justify-end">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="col-span-12 -mt-1 text-right text-xs text-muted-foreground tabular-nums">{sub > 0 ? formatIDR(sub) : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5"><Label>Catatan</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatIDR(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span className="tabular-nums">{formatIDR(tax)}</span></div>
                <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{formatIDR(total)}</span></div>
              </div>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
              <Button variant="outline" onClick={() => savePO(false)} disabled={saving}>Simpan draft</Button>
              <Button onClick={() => savePO(true)} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Order ke supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : pos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground"><FileText className="h-6 w-6" /></div>
          <h2 className="text-lg font-semibold">Belum ada PO</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">Buat PO untuk catat pembelian bahan.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">No. PO</th>
                <th className="px-4 py-2.5 text-left">Tanggal</th>
                <th className="px-4 py-2.5 text-left">Supplier</th>
                <th className="px-4 py-2.5 text-right">Item</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pos.map((p) => {
                const sup = suppliers.find((s) => s.id === p.supplier_id);
                return (
                  <tr key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => nav({ to: "/app/purchase-orders/$poId", params: { poId: p.id } })}>
                    <td className="px-4 py-3 font-medium">{p.po_no}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{p.order_date}</td>
                    <td className="px-4 py-3">{sup?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{itemCounts[p.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "received" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : p.status === "ordered" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                        : p.status === "cancelled" ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatIDR(p.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
