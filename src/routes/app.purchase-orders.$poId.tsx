import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, CheckCircle2, X, Trash2, Send, Printer, Eye, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/purchase-orders/$poId")({
  component: PODetailPage,
});

type PO = {
  id: string;
  po_no: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  shop_id: string;
  supplier_id: string | null;
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  note: string | null;
  created_at: string;
};
type POItem = {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  received_qty: number;
};
type Ingredient = { id: string; name: string; unit: string };
type Supplier = { id: string; name: string; phone: string | null; contact_name: string | null; address?: string | null; email?: string | null };
type Shop = { id: string; name: string; address?: string | null; phone?: string | null; email?: string | null; logo_url?: string | null };

type PaperSize = "a4" | "letter" | "thermal80" | "thermal58";
type MarginMode = "narrow" | "normal" | "wide";
type Orientation = "portrait" | "landscape";
type PrintPrefs = {
  paper: PaperSize;
  margin: MarginMode;
  orientation: Orientation;
  tray: string;        // free-text printer tray hint, e.g. "Tray 1"
  printerName: string; // free-text printer name, just a reminder
  zoom: number;       // 0.5 – 1.4
  fitToPage: boolean;
  showTax: boolean;
  showNotes: boolean;
  showShipping: boolean;
  activePresetId: string | null;
};

type PrinterPreset = {
  id: string;
  name: string;
  prefs: Omit<PrintPrefs, "activePresetId">;
};

const PREFS_KEY = "po-print-prefs/v1";
const PRESETS_KEY = "po-printer-presets/v1";
const DEFAULT_PRESET_KEY = "po-printer-default/v1";

function loadDefaultPresetId(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(DEFAULT_PRESET_KEY); } catch { return null; }
}
function saveDefaultPresetId(id: string | null) {
  try {
    if (id) localStorage.setItem(DEFAULT_PRESET_KEY, id);
    else localStorage.removeItem(DEFAULT_PRESET_KEY);
  } catch { /* noop */ }
}
const DEFAULT_PREFS: PrintPrefs = {
  paper: "a4",
  margin: "normal",
  orientation: "portrait",
  tray: "",
  printerName: "",
  zoom: 1,
  fitToPage: false,
  showTax: true,
  showNotes: true,
  showShipping: true,
  activePresetId: null,
};

function loadPrefs(): PrintPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return DEFAULT_PREFS; }
}

function loadPresets(): PrinterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function savePresets(list: PrinterPreset[]) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch { /* noop */ }
}

const PAPER_LABEL: Record<PaperSize, string> = {
  a4: "A4 (210 × 297 mm)",
  letter: "Letter (216 × 279 mm)",
  thermal80: "Thermal 80 mm",
  thermal58: "Thermal 58 mm",
};

/** Format a YYYY-MM-DD or ISO date to id-ID long form: "29 April 2026". */
function formatDateID(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

/** Normalize PO no for display — uppercase, trim, ensure "PO-" prefix. */
function formatPONo(raw: string): string {
  const s = (raw ?? "").trim().toUpperCase();
  if (!s) return "—";
  return /^PO[-_]/i.test(s) ? s : `PO-${s}`;
}

function statusBadge(status: PO["status"]) {
  const map: Record<PO["status"], string> = {
    draft: "bg-muted text-muted-foreground",
    ordered: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    received: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    cancelled: "bg-destructive/15 text-destructive",
  };
  const label = { draft: "Draft", ordered: "Sudah dipesan", received: "Diterima", cancelled: "Dibatalkan" }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>{label}</span>;
}

function PODetailPage() {
  const { poId } = Route.useParams();
  const nav = useNavigate();
  const [po, setPo] = useState<PO | null>(null);
  const [items, setItems] = useState<POItem[]>([]);
  const [ingMap, setIngMap] = useState<Record<string, Ingredient>>({});
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [prefs, setPrefs] = useState<PrintPrefs>(() => loadPrefs());
  const [presets, setPresets] = useState<PrinterPreset[]>(() => loadPresets());
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(() => loadDefaultPresetId());
  const [presetName, setPresetName] = useState("");

  // Persist prefs whenever they change
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  }, [prefs]);

  // Apply prefs to <body> as data attributes so CSS can react
  useEffect(() => {
    const b = document.body;
    b.dataset.poPaper = prefs.paper;
    b.dataset.poMargin = prefs.margin;
    b.dataset.poOrient = prefs.orientation;
    return () => {
      delete b.dataset.poPaper;
      delete b.dataset.poMargin;
      delete b.dataset.poOrient;
    };
  }, [prefs.paper, prefs.margin, prefs.orientation]);

  // Inject a per-paper @page rule for the actual printout
  useEffect(() => {
    const id = "po-page-rule";
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    const orient = prefs.orientation;
    let size: string;
    switch (prefs.paper) {
      case "letter":    size = `Letter ${orient}`; break;
      case "thermal80": size = "80mm auto"; break;
      case "thermal58": size = "58mm auto"; break;
      default:          size = `A4 ${orient}`; break;
    }
    style.textContent = `@media print { @page { size: ${size}; margin: 0; } }`;
    return () => { if (style) style.textContent = ""; };
  }, [prefs.paper, prefs.orientation]);

  function applyPreset(id: string) {
    const found = presets.find((p) => p.id === id);
    if (!found) return;
    setPrefs({ ...found.prefs, activePresetId: found.id });
    toast.success(`Preset "${found.name}" diterapkan`);
  }
  function saveCurrentAsPreset() {
    const name = presetName.trim();
    if (!name) { toast.error("Beri nama preset dulu"); return; }
    const id = crypto.randomUUID();
    const { activePresetId: _omit, ...rest } = prefs;
    void _omit;
    const next = [...presets, { id, name, prefs: rest }];
    setPresets(next); savePresets(next);
    setPrefs((p) => ({ ...p, activePresetId: id }));
    setPresetName("");
    toast.success(`Preset "${name}" disimpan di perangkat ini`);
  }
  function updateActivePreset() {
    if (!prefs.activePresetId) return;
    const { activePresetId: _omit, ...rest } = prefs;
    void _omit;
    const next = presets.map((p) => p.id === prefs.activePresetId ? { ...p, prefs: rest } : p);
    setPresets(next); savePresets(next);
    toast.success("Preset diperbarui");
  }
  function deleteActivePreset() {
    if (!prefs.activePresetId) return;
    const target = presets.find((p) => p.id === prefs.activePresetId);
    if (!target) return;
    if (!confirm(`Hapus preset "${target.name}"?`)) return;
    const next = presets.filter((p) => p.id !== prefs.activePresetId);
    setPresets(next); savePresets(next);
    setPrefs((p) => ({ ...p, activePresetId: null }));
    if (defaultPresetId === target.id) {
      setDefaultPresetId(null);
      saveDefaultPresetId(null);
    }
  }
  function toggleDefaultPreset(makeDefault: boolean) {
    if (makeDefault) {
      if (!prefs.activePresetId) { toast.error("Pilih preset dulu"); return; }
      setDefaultPresetId(prefs.activePresetId);
      saveDefaultPresetId(prefs.activePresetId);
      const name = presets.find((p) => p.id === prefs.activePresetId)?.name ?? "Preset";
      toast.success(`"${name}" dipakai otomatis tiap buka Print Preview`);
    } else {
      setDefaultPresetId(null);
      saveDefaultPresetId(null);
      toast.success("Default preset dihapus");
    }
  }

  /** Open the Print Preview, applying the saved default preset (if any)
   *  whenever it differs from the currently-loaded prefs. */
  function openPreview() {
    if (defaultPresetId) {
      const def = presets.find((p) => p.id === defaultPresetId);
      if (def && prefs.activePresetId !== def.id) {
        setPrefs({ ...def.prefs, activePresetId: def.id });
      }
    }
    setPreviewOpen(true);
  }


  async function load() {
    setLoading(true);
    const { data: poData, error } = await supabase.from("purchase_orders").select("*").eq("id", poId).single();
    if (error || !poData) { toast.error(error?.message ?? "PO tidak ditemukan"); setLoading(false); return; }
    setPo(poData as PO);
    const [itRes, ingRes, supRes, shopRes] = await Promise.all([
      supabase.from("purchase_order_items").select("*").eq("po_id", poId),
      supabase.from("ingredients").select("id, name, unit").eq("shop_id", poData.shop_id),
      poData.supplier_id
        ? supabase.from("suppliers").select("id, name, phone, contact_name, address, email").eq("id", poData.supplier_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("coffee_shops").select("id, name, address, phone, email, logo_url").eq("id", poData.shop_id).single(),
    ]);
    setItems((itRes.data ?? []) as POItem[]);
    const map: Record<string, Ingredient> = {};
    ((ingRes.data ?? []) as Ingredient[]).forEach((i) => { map[i.id] = i; });
    setIngMap(map);
    setSupplier((supRes as { data: Supplier | null }).data ?? null);
    setShop((shopRes as { data: Shop | null }).data ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [poId]);

  async function setStatus(status: PO["status"]) {
    if (!po) return;
    setBusy(true);
    const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", po.id);
    if (error) toast.error(error.message); else { toast.success("Status diperbarui"); load(); }
    setBusy(false);
  }

  async function receivePO() {
    if (!po) return;
    if (!confirm(`Terima PO ${formatPONo(po.po_no)}? Stok akan otomatis bertambah dan HPP akan di-update.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("receive_purchase_order", { _po_id: po.id });
    if (error) toast.error(error.message); else { toast.success("PO diterima — stok diperbarui"); load(); }
    setBusy(false);
  }

  async function deletePO() {
    if (!po) return;
    if (!confirm(`Hapus PO ${formatPONo(po.po_no)}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusy(true);
    await supabase.from("purchase_order_items").delete().eq("po_id", po.id);
    const { error } = await supabase.from("purchase_orders").delete().eq("id", po.id);
    if (error) { toast.error(error.message); setBusy(false); }
    else { toast.success("PO dihapus"); nav({ to: "/app/purchase-orders" }); }
  }

  // Compute fit-to-page zoom: scale paper width to fit available preview area.
  const previewMaxPx = 760; // approximate inner dialog width budget
  const basePaperPx: Record<PaperSize, number> = {
    a4: 794,         // 210mm @ ~96dpi
    letter: 816,     // 216mm
    thermal80: 302,  // 80mm
    thermal58: 219,  // 58mm
  };
  const isThermal = prefs.paper === "thermal80" || prefs.paper === "thermal58";
  const isLandscape = prefs.orientation === "landscape" && !isThermal;
  const paperPx = isLandscape
    ? (prefs.paper === "letter" ? 1054 : 1123) // 279mm/297mm @ ~96dpi
    : basePaperPx[prefs.paper];
  const fitZoom = useMemo(
    () => Math.min(1, previewMaxPx / paperPx),
    [paperPx],
  );
  const effectiveZoom = prefs.fitToPage ? fitZoom : prefs.zoom;

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!po) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-center text-muted-foreground">PO tidak ditemukan.</div>;
  }

  const statusLabel = { draft: "Draft", ordered: "Sudah dipesan", received: "Diterima", cancelled: "Dibatalkan" }[po.status];

  return (
    <>
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 print:hidden">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/app/purchase-orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali ke daftar PO
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openPreview}>
            <Eye className="mr-1.5 h-4 w-4" />Preview
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Cetak</Button>
        </div>
      </div>


      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{formatPONo(po.po_no)}</h1>
            <div className="mt-2">{statusBadge(po.status)}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">Tanggal terbit: <span className="text-foreground">{formatDateID(po.order_date)}</span></div>
            {po.expected_date && <div className="text-muted-foreground">Kedatangan: <span className="text-foreground">{formatDateID(po.expected_date)}</span></div>}
            {po.received_date && <div className="text-muted-foreground">Diterima: <span className="text-foreground">{formatDateID(po.received_date)}</span></div>}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</div>
            {supplier ? (
              <div className="mt-1">
                <Link to="/app/suppliers" className="font-medium hover:underline">{supplier.name}</Link>
                {supplier.contact_name && <div className="text-xs text-muted-foreground">{supplier.contact_name}</div>}
                {supplier.phone && <div className="text-xs text-muted-foreground">{supplier.phone}</div>}
              </div>
            ) : <div className="mt-1 text-sm text-muted-foreground">— tidak ditentukan —</div>}
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Catatan</div>
            <div className="mt-1 text-sm whitespace-pre-wrap">{po.note || <span className="text-muted-foreground">—</span>}</div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">Bahan</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Harga / unit</th>
                <th className="px-3 py-2.5 text-right">Subtotal</th>
                {po.status === "received" && <th className="px-3 py-2.5 text-right">Diterima</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it) => {
                const ig = ingMap[it.ingredient_id];
                return (
                  <tr key={it.id}>
                    <td className="px-3 py-2.5 font-medium">{ig?.name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{Number(it.quantity)} {ig?.unit}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatIDR(it.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatIDR(it.subtotal)}</td>
                    {po.status === "received" && (
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">+{Number(it.received_qty)} {ig?.unit}</td>
                    )}
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Tidak ada item.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatIDR(po.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span className="tabular-nums">{formatIDR(po.tax)}</span></div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatIDR(po.total)}</span></div>
        </div>

        {po.status !== "received" && po.status !== "cancelled" && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 print:hidden">
            {po.status === "draft" && (
              <>
                <Button variant="ghost" onClick={deletePO} disabled={busy} className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
                </Button>
                <Button variant="outline" onClick={() => setStatus("cancelled")} disabled={busy}>
                  <X className="mr-1.5 h-4 w-4" /> Batalkan
                </Button>
                <Button onClick={() => setStatus("ordered")} disabled={busy}>
                  <Send className="mr-1.5 h-4 w-4" /> Order ke supplier
                </Button>
              </>
            )}
            {po.status === "ordered" && (
              <>
                <Button variant="outline" onClick={() => setStatus("cancelled")} disabled={busy}>
                  <X className="mr-1.5 h-4 w-4" /> Batalkan
                </Button>
                <Button onClick={receivePO} disabled={busy}>
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                  Terima & update stok
                </Button>
              </>
            )}
          </div>
        )}

        {po.status === "received" && (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300 print:hidden">
            <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
            PO sudah diterima — stok bahan dan HPP rata-rata sudah otomatis terupdate.
          </div>
        )}
      </div>
    </div>

    {/* Print-only sheet */}
    <div className="po-print">
      <POSheetBody po={po} items={items} ingMap={ingMap} supplier={supplier} shop={shop} statusLabel={statusLabel} prefs={prefs} />
    </div>

    {/* Print preview dialog */}
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className="max-w-[min(96vw,1100px)] max-h-[94vh] overflow-hidden p-0 gap-0 bg-muted/40 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 print:hidden">
          <DialogTitle>Preview cetak — {formatPONo(po.po_no)}</DialogTitle>
        </DialogHeader>

        {/* Printer presets — saved per device (localStorage) */}
        <div className="border-y bg-accent/30 px-5 py-3 print:hidden">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Settings2 className="h-3.5 w-3.5" /> Preset printer (tersimpan di perangkat ini)
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={prefs.activePresetId ?? "__none"}
                onValueChange={(v) => v === "__none"
                  ? setPrefs((p) => ({ ...p, activePresetId: null }))
                  : applyPreset(v)}
              >
                <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Pilih preset…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Tanpa preset —</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{defaultPresetId === p.id ? "  · default" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {prefs.activePresetId && (
                <>
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
                    <Switch
                      id="default-preset"
                      checked={defaultPresetId === prefs.activePresetId}
                      onCheckedChange={toggleDefaultPreset}
                    />
                    <Label htmlFor="default-preset" className="text-xs">Pakai sebagai default</Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={updateActivePreset}>Simpan perubahan</Button>
                  <Button variant="ghost" size="sm" onClick={deleteActivePreset} className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="mis. Epson Kasir A4"
                className="h-8 w-[220px]"
              />
              <Button size="sm" onClick={saveCurrentAsPreset}>
                <Save className="mr-1 h-3.5 w-3.5" /> Simpan sebagai baru
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="grid gap-3 border-b bg-background px-5 py-3 text-sm md:grid-cols-2 lg:grid-cols-3 print:hidden">
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Kertas</Label>
            <Select value={prefs.paper} onValueChange={(v) => setPrefs((p) => ({ ...p, paper: v as PaperSize }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">{PAPER_LABEL.a4}</SelectItem>
                <SelectItem value="letter">{PAPER_LABEL.letter}</SelectItem>
                <SelectItem value="thermal80">{PAPER_LABEL.thermal80}</SelectItem>
                <SelectItem value="thermal58">{PAPER_LABEL.thermal58}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Orientasi</Label>
            <Select
              value={prefs.orientation}
              onValueChange={(v) => setPrefs((p) => ({ ...p, orientation: v as Orientation }))}
              disabled={isThermal}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait</SelectItem>
                <SelectItem value="landscape">Landscape</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Margin</Label>
            <Select value={prefs.margin} onValueChange={(v) => setPrefs((p) => ({ ...p, margin: v as MarginMode }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="narrow">Sempit (8 mm)</SelectItem>
                <SelectItem value="normal">Normal (12–14 mm)</SelectItem>
                <SelectItem value="wide">Lebar (20–22 mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Printer</Label>
            <Input
              value={prefs.printerName}
              onChange={(e) => setPrefs((p) => ({ ...p, printerName: e.target.value }))}
              placeholder="mis. Epson L3210"
              className="h-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Tray</Label>
            <Input
              value={prefs.tray}
              onChange={(e) => setPrefs((p) => ({ ...p, tray: e.target.value }))}
              placeholder="mis. Tray 1 / Manual"
              className="h-8"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-20 shrink-0 text-xs text-muted-foreground">Zoom</Label>
            <Slider
              value={[Math.round(prefs.zoom * 100)]}
              min={50} max={140} step={5}
              disabled={prefs.fitToPage}
              onValueChange={([v]) => setPrefs((p) => ({ ...p, zoom: v / 100 }))}
              className="flex-1"
            />
            <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">
              {Math.round(effectiveZoom * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="fit" checked={prefs.fitToPage} onCheckedChange={(v) => setPrefs((p) => ({ ...p, fitToPage: v }))} />
            <Label htmlFor="fit" className="text-xs">Fit to page</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="tax" checked={prefs.showTax} onCheckedChange={(v) => setPrefs((p) => ({ ...p, showTax: v }))} />
            <Label htmlFor="tax" className="text-xs">Tampilkan pajak</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="notes" checked={prefs.showNotes} onCheckedChange={(v) => setPrefs((p) => ({ ...p, showNotes: v }))} />
            <Label htmlFor="notes" className="text-xs">Tampilkan catatan</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ship" checked={prefs.showShipping} onCheckedChange={(v) => setPrefs((p) => ({ ...p, showShipping: v }))} />
            <Label htmlFor="ship" className="text-xs">Alamat pengiriman</Label>
          </div>
          <div className="flex items-center justify-end gap-2 lg:col-span-3">
            {(prefs.tray || prefs.printerName) && (
              <span className="mr-auto text-xs text-muted-foreground">
                Tip: pilih “{prefs.printerName || "printer Anda"}”{prefs.tray ? ` · ${prefs.tray}` : ""} di dialog cetak browser.
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setPrefs(DEFAULT_PREFS)}>Reset</Button>
          </div>
        </div>

        {/* Scaled preview area */}
        <div className="flex-1 overflow-auto px-4 py-6">
          <div
            style={{
              width: paperPx * effectiveZoom,
              margin: "0 auto",
            }}
          >
            <div className="po-preview" style={{ ["--po-zoom" as string]: String(effectiveZoom) }}>
              <POSheetBody po={po} items={items} ingMap={ingMap} supplier={supplier} shop={shop} statusLabel={statusLabel} prefs={prefs} />
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-background print:hidden">
          <Button variant="outline" onClick={() => setPreviewOpen(false)}>Tutup</Button>
          <Button onClick={() => { setPreviewOpen(false); setTimeout(() => window.print(), 150); }}>
            <Printer className="mr-1.5 h-4 w-4" /> Cetak sekarang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function POSheetBody({
  po, items, ingMap, supplier, shop, statusLabel, prefs,
}: {
  po: PO;
  items: POItem[];
  ingMap: Record<string, Ingredient>;
  supplier: Supplier | null;
  shop: Shop | null;
  statusLabel: string;
  prefs: PrintPrefs;
}) {
  return (
    <>
      <div className="row">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {shop?.logo_url && (
            <img src={shop.logo_url} alt="" style={{ height: 48, width: 48, objectFit: "contain", borderRadius: 6 }} />
          )}
          <div>
            <h1>Purchase Order</h1>
            <div className="muted" style={{ marginTop: 4, fontSize: "10pt", fontWeight: 600 }}>{shop?.name ?? ""}</div>
            {shop?.address && <div className="muted" style={{ fontSize: "9.5pt" }}>{shop.address}</div>}
            {(shop?.phone || shop?.email) && (
              <div className="muted" style={{ fontSize: "9.5pt" }}>
                {[shop.phone, shop.email].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className={`stamp ${po.status}`}>{statusLabel}</div>
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: "12pt", letterSpacing: "0.02em" }}>
            {formatPONo(po.po_no)}
          </div>
          <div className="muted" style={{ fontSize: "9.5pt" }}>Tanggal terbit: {formatDateID(po.order_date)}</div>
          {po.expected_date && <div className="muted" style={{ fontSize: "9.5pt" }}>Kedatangan: {formatDateID(po.expected_date)}</div>}
          {po.received_date && <div className="muted" style={{ fontSize: "9.5pt" }}>Diterima: {formatDateID(po.received_date)}</div>}
        </div>
      </div>

      <div className="grid-2">
        <div className="box">
          <div className="label">Supplier</div>
          {supplier ? (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontWeight: 600 }}>{supplier.name}</div>
              {supplier.contact_name && <div>{supplier.contact_name}</div>}
              {supplier.phone && <div className="muted">{supplier.phone}</div>}
              {supplier.email && <div className="muted">{supplier.email}</div>}
              {supplier.address && <div className="muted" style={{ marginTop: 2 }}>{supplier.address}</div>}
            </div>
          ) : <div className="muted" style={{ marginTop: 4 }}>— tidak ditentukan —</div>}
        </div>
        {prefs.showShipping && (
          <div className="box">
            <div className="label">Alamat pengiriman</div>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{shop?.name ?? "—"}</div>
            {shop?.address && <div className="muted" style={{ fontSize: "9.5pt", marginTop: 2 }}>{shop.address}</div>}
            <div className="muted" style={{ fontSize: "9.5pt", marginTop: 6 }}>
              Dicetak: {new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
            </div>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: "6%" }}>#</th>
            <th>Bahan</th>
            <th className="num" style={{ width: "14%" }}>Qty</th>
            <th className="num" style={{ width: "20%" }}>Harga / unit</th>
            <th className="num" style={{ width: "20%" }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const ig = ingMap[it.ingredient_id];
            return (
              <tr key={it.id}>
                <td>{idx + 1}</td>
                <td>{ig?.name ?? "—"}</td>
                <td className="num">{Number(it.quantity)} {ig?.unit}</td>
                <td className="num">{formatIDR(it.unit_cost)}</td>
                <td className="num">{formatIDR(it.subtotal)}</td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: "center", padding: "16px 0" }} className="muted">Tidak ada item.</td></tr>
          )}
        </tbody>
      </table>

      <div className="totals">
        <div className="line"><span className="muted">Subtotal</span><span className="num">{formatIDR(po.subtotal)}</span></div>
        {prefs.showTax && Number(po.tax) > 0 && (
          <div className="line"><span className="muted">Pajak</span><span className="num">{formatIDR(po.tax)}</span></div>
        )}
        <div className="line grand"><span>Total</span><span className="num">{formatIDR(po.total)}</span></div>
      </div>

      {prefs.showNotes && po.note && (
        <div className="note">
          <div className="label">Catatan</div>
          <div style={{ marginTop: 4 }}>{po.note}</div>
        </div>
      )}

      <div className="footer">
        <div className="sign">Hormat kami,<br/>{shop?.name ?? ""}</div>
        <div className="sign">Penerima,<br/>{supplier?.name ?? ""}</div>
      </div>
    </>
  );
}
