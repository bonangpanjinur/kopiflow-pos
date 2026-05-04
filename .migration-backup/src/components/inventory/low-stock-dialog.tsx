import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, FileText, Package } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
};
type RecentSupplier = { ingredient_id: string; supplier_id: string | null; supplier_name: string | null };

type Group = {
  supplierId: string | null;
  supplierName: string;
  items: (Ingredient & { suggestedQty: number; lineCost: number })[];
  totalCost: number;
};

export function LowStockDialog({
  open, onOpenChange, shopId,
}: { open: boolean; onOpenChange: (v: boolean) => void; shopId: string | null }) {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Ingredient[]>([]);
  const [recent, setRecent] = useState<Record<string, RecentSupplier>>({});
  const [creating, setCreating] = useState<string | null>(null);

  async function load() {
    if (!shopId) return;
    setLoading(true);
    const { data: ings } = await supabase
      .from("ingredients")
      .select("id, name, unit, current_stock, min_stock, cost_per_unit")
      .eq("shop_id", shopId).eq("is_active", true);
    const low = ((ings ?? []) as Ingredient[]).filter(
      (i) => i.min_stock > 0 && Number(i.current_stock) <= Number(i.min_stock),
    );
    setItems(low);

    // Find most recent supplier per ingredient via received POs
    if (low.length > 0) {
      const { data: poItems } = await supabase
        .from("purchase_order_items")
        .select("ingredient_id, po_id, created_at, purchase_orders!inner(supplier_id, status, suppliers(name))")
        .in("ingredient_id", low.map((i) => i.id))
        .order("created_at", { ascending: false });
      const map: Record<string, RecentSupplier> = {};
      (poItems ?? []).forEach((row: any) => {
        if (map[row.ingredient_id]) return;
        const sup = row.purchase_orders;
        if (!sup) return;
        map[row.ingredient_id] = {
          ingredient_id: row.ingredient_id,
          supplier_id: sup.supplier_id,
          supplier_name: sup.suppliers?.name ?? null,
        };
      });
      setRecent(map);
    } else {
      setRecent({});
    }
    setLoading(false);
  }

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, shopId]);

  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();
    for (const i of items) {
      const sug = Math.max(Number(i.min_stock) * 2 - Number(i.current_stock), Number(i.min_stock));
      const lineCost = sug * Number(i.cost_per_unit);
      const r = recent[i.id];
      const key = r?.supplier_id ?? "__none__";
      const name = r?.supplier_name ?? "Belum ada riwayat supplier";
      let g = byKey.get(key);
      if (!g) {
        g = { supplierId: r?.supplier_id ?? null, supplierName: name, items: [], totalCost: 0 };
        byKey.set(key, g);
      }
      g.items.push({ ...i, suggestedQty: sug, lineCost });
      g.totalCost += lineCost;
    }
    return Array.from(byKey.values()).sort((a, b) => (b.supplierId ? 1 : 0) - (a.supplierId ? 1 : 0));
  }, [items, recent]);

  async function createPOFromGroup(g: Group) {
    if (!shopId) return;
    setCreating(g.supplierId ?? "__none__");
    const poNo = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
    const subtotal = g.totalCost;
    const { data: po, error } = await supabase.from("purchase_orders").insert({
      shop_id: shopId,
      supplier_id: g.supplierId,
      po_no: poNo,
      status: "draft",
      subtotal, tax: 0, total: subtotal,
      note: `Auto-template dari peringatan stok minimum (${g.items.length} bahan)`,
    }).select("id").single();
    if (error || !po) { toast.error(error?.message ?? "Gagal"); setCreating(null); return; }
    const { error: itErr } = await supabase.from("purchase_order_items").insert(
      g.items.map((i) => ({
        po_id: po.id,
        ingredient_id: i.id,
        quantity: i.suggestedQty,
        unit_cost: i.cost_per_unit,
        subtotal: i.lineCost,
      }))
    );
    if (itErr) { toast.error(itErr.message); setCreating(null); return; }
    toast.success("Draft PO dibuat — silakan review");
    onOpenChange(false);
    nav({ to: "/app/purchase-orders/$poId", params: { poId: po.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" /> Bahan Menipis
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Semua stok aman — tidak ada bahan di bawah minimum.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {items.length} bahan di bawah stok minimum. Sistem mengelompokkan rekomendasi PO berdasarkan supplier terakhir.
            </p>
            {groups.map((g) => (
              <div key={g.supplierId ?? "none"} className="rounded-lg border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold">{g.supplierName}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.items.length} bahan · estimasi {formatIDR(g.totalCost)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => createPOFromGroup(g)}
                    disabled={creating === (g.supplierId ?? "__none__")}
                  >
                    {creating === (g.supplierId ?? "__none__")
                      ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                    Buat draft PO
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Bahan</th>
                      <th className="px-3 py-2 text-right">Stok</th>
                      <th className="px-3 py-2 text-right">Min</th>
                      <th className="px-3 py-2 text-right">Saran qty</th>
                      <th className="px-3 py-2 text-right">Estimasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.items.map((i) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2 font-medium">{i.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-600 font-medium">{i.current_stock} {i.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{i.min_stock}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{i.suggestedQty} {i.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatIDR(i.lineCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button variant="outline" onClick={() => { onOpenChange(false); nav({ to: "/app/inventory" }); }}>
            Buka Inventori
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
