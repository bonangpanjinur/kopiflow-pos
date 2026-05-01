import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Undo2, Download, FileText, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadCSV } from "@/lib/export";

export const Route = createFileRoute("/admin/plans/$id/matrix")({ component: PlanMatrix });

type Feature = { key: string; name: string; category: string };
type Theme = { key: string; name: string; tier_hint: string | null };
type PlanFeature = { plan_id: string; feature_key: string; requires_min_months: number | null; limit_value: number | null };
type PlanTheme = { plan_id: string; theme_key: string; requires_min_months: number | null };

type UndoEntry = {
  editKey: string;
  itemKey: string;
  kind: "feature" | "theme";
  oldValue: number;
  newValue: number;
};

type SavingStatus = { state: "saving" | "retrying"; attempt?: number } | null;

// ── Client-side validation ──
function validateMinMonthsInput(raw: string): { valid: false; msg: string } | { valid: true; value: number } {
  if (raw.trim() === "") return { valid: false, msg: "Wajib diisi" };
  if (/[.,]/.test(raw)) return { valid: false, msg: "Harus bilangan bulat (tanpa desimal)" };
  const n = Number(raw);
  if (Number.isNaN(n)) return { valid: false, msg: "Bukan angka" };
  if (!Number.isInteger(n)) return { valid: false, msg: "Harus bilangan bulat" };
  if (n < 0) return { valid: false, msg: "Min 0" };
  if (n > 120) return { valid: false, msg: "Maks 120" };
  return { valid: true, value: n };
}

function PlanMatrix() {
  const { id: planId } = Route.useParams();
  const [planName, setPlanName] = useState("");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [pf, setPf] = useState<PlanFeature[]>([]);
  const [pt, setPt] = useState<PlanTheme[]>([]);
  const [loading, setLoading] = useState(true);

  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const markBusy = (key: string) => setBusyKeys((s) => new Set(s).add(key));
  const clearBusy = (key: string) => setBusyKeys((s) => { const n = new Set(s); n.delete(key); return n; });

  const [monthEdits, setMonthEdits] = useState<Record<string, string>>({});
  const [monthErrors, setMonthErrors] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, SavingStatus>>({});

  // Undo stack (per editKey, only last change)
  const [undoStack, setUndoStack] = useState<Record<string, UndoEntry>>({});
  const [undoing, setUndoing] = useState<Set<string>>(new Set());

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exporting, setExporting] = useState(false);

  // Track load timestamp for staleness detection
  const loadedAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const [planRes, featRes, themeRes, pfRes, ptRes] = await Promise.all([
      supabase.from("plans").select("name").eq("id", planId).single(),
      supabase.from("features").select("key, name, category").eq("is_active", true).order("sort_order"),
      supabase.from("themes").select("key, name, tier_hint").eq("is_active", true).order("sort_order"),
      supabase.from("plan_features").select("*").eq("plan_id", planId),
      supabase.from("plan_themes").select("*").eq("plan_id", planId),
    ]);
    setPlanName(planRes.data?.name ?? "");
    setFeatures((featRes.data as Feature[]) ?? []);
    setThemes((themeRes.data as Theme[]) ?? []);
    setPf((pfRes.data as PlanFeature[]) ?? []);
    setPt((ptRes.data as PlanTheme[]) ?? []);
    setMonthEdits({});
    setMonthErrors({});
    setSavingStatus({});
    loadedAt.current = Date.now();
    setLoading(false);
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const isFeatureEnabled = (key: string) => pf.some((x) => x.feature_key === key);
  const isThemeEnabled = (key: string) => pt.some((x) => x.theme_key === key);
  const getFeatureMinMonths = (key: string) => pf.find((x) => x.feature_key === key)?.requires_min_months ?? 0;
  const getThemeMinMonths = (key: string) => pt.find((x) => x.theme_key === key)?.requires_min_months ?? 0;

  const fName = (key: string) => features.find((f) => f.key === key)?.name ?? key;
  const tName = (key: string) => themes.find((t) => t.key === key)?.name ?? key;

  const describeError = (code: string | undefined, message: string, itemLabel: string) => {
    if (code === "23505") return `"${itemLabel}" sudah terdaftar di plan "${planName}" (duplikat)`;
    if (message.includes("requires_min_months must be between"))
      return `Min bulan "${itemLabel}" [${planName}]: harus 0–120`;
    if (message.includes("requires_min_months must be an integer"))
      return `Min bulan "${itemLabel}" [${planName}]: harus bilangan bulat`;
    return `[${planName} / ${itemLabel}] ${message}`;
  };

  const handleMonthChange = (editKey: string, raw: string) => {
    setMonthEdits((m) => ({ ...m, [editKey]: raw }));
    if (raw === "") {
      setMonthErrors((e) => { const n = { ...e }; delete n[editKey]; return n; });
      return;
    }
    const v = validateMinMonthsInput(raw);
    if (!v.valid) {
      setMonthErrors((e) => ({ ...e, [editKey]: v.msg }));
    } else {
      setMonthErrors((e) => { const n = { ...e }; delete n[editKey]; return n; });
    }
  };

  // ── Toggle Feature ──
  const toggleFeature = async (key: string, enabled: boolean) => {
    if (busyKeys.has(key)) return;
    if (enabled && isFeatureEnabled(key)) {
      toast.info(`Fitur "${fName(key)}" sudah aktif di plan "${planName}"`);
      return;
    }
    markBusy(key);
    try {
      if (enabled) {
        // Check existence before insert (duplicate prevention)
        const { data: existing } = await supabase.from("plan_features")
          .select("plan_id").eq("plan_id", planId).eq("feature_key", key).maybeSingle();
        if (existing) {
          toast.error(`Fitur "${fName(key)}" (key: ${key}) sudah ada di plan "${planName}" — duplikat dicegah`);
          await load();
          return;
        }
        const { error } = await supabase.from("plan_features").insert({ plan_id: planId, feature_key: key });
        if (error) { toast.error(describeError(error.code, error.message, fName(key))); return; }
        toast.success(`Fitur "${fName(key)}" diaktifkan untuk plan "${planName}"`);
      } else {
        const { error } = await supabase.from("plan_features").delete().eq("plan_id", planId).eq("feature_key", key);
        if (error) { toast.error(describeError(error.code, error.message, fName(key))); return; }
        toast.success(`Fitur "${fName(key)}" dinonaktifkan dari plan "${planName}"`);
      }
      await load();
    } finally { clearBusy(key); }
  };

  // ── Toggle Theme ──
  const toggleTheme = async (key: string, enabled: boolean) => {
    if (busyKeys.has(key)) return;
    if (enabled && isThemeEnabled(key)) {
      toast.info(`Tema "${tName(key)}" sudah aktif di plan "${planName}"`);
      return;
    }
    markBusy(key);
    try {
      if (enabled) {
        const { data: existing } = await supabase.from("plan_themes")
          .select("plan_id").eq("plan_id", planId).eq("theme_key", key).maybeSingle();
        if (existing) {
          toast.error(`Tema "${tName(key)}" (key: ${key}) sudah ada di plan "${planName}" — duplikat dicegah`);
          await load();
          return;
        }
        const { error } = await supabase.from("plan_themes").insert({ plan_id: planId, theme_key: key });
        if (error) { toast.error(describeError(error.code, error.message, tName(key))); return; }
        toast.success(`Tema "${tName(key)}" diaktifkan untuk plan "${planName}"`);
      } else {
        const { error } = await supabase.from("plan_themes").delete().eq("plan_id", planId).eq("theme_key", key);
        if (error) { toast.error(describeError(error.code, error.message, tName(key))); return; }
        toast.success(`Tema "${tName(key)}" dinonaktifkan dari plan "${planName}"`);
      }
      await load();
    } finally { clearBusy(key); }
  };

  // ── Save min months with concurrency check + retry status ──
  const saveMinMonths = async (editKey: string, itemKey: string, kind: "feature" | "theme") => {
    const raw = monthEdits[editKey];
    if (raw === undefined) return;
    const itemLabel = kind === "feature" ? fName(itemKey) : tName(itemKey);

    const result = validateMinMonthsInput(raw);
    if (!result.valid) {
      toast.error(`${itemLabel} [${planName}]: ${result.msg}`);
      return;
    }
    const currentVal = kind === "feature" ? getFeatureMinMonths(itemKey) : getThemeMinMonths(itemKey);
    if (result.value === currentVal) {
      toast.info("Nilai tidak berubah");
      return;
    }

    setSavingStatus((s) => ({ ...s, [editKey]: { state: "saving" } }));
    try {
      const { updateMinMonths } = await import("@/server/plan-matrix.functions");
      const res = await updateMinMonths({
        data: {
          plan_id: planId,
          item_key: itemKey,
          kind,
          new_value: result.value,
          expected_old_value: currentVal,
        },
      });

      if (res.conflict) {
        toast.warning(
          `Konflik: ${itemLabel} [${planName}]`,
          { description: `Data telah diubah oleh orang lain (menjadi ${res.actual_value}). Silakan muat ulang.` }
        );
        await load();
        return;
      }

      if (res.success) {
        toast.success(`Min bulan "${itemLabel}" [${planName}] diperbarui ke ${result.value}`);
        setUndoStack((s) => ({
          ...s,
          [editKey]: { editKey, itemKey, kind, oldValue: currentVal, newValue: result.value },
        }));
        await load();
      } else {
        toast.error(describeError(undefined, res.error || "Gagal simpan", itemLabel));
      }
    } catch (e) {
      toast.error(`[System Error] ${itemLabel}: ${(e as Error).message}`);
    } finally {
      setSavingStatus((s) => { const n = { ...s }; delete n[editKey]; return n; });
    }
  };

  // ── Undo ──
  const undoChange = async (editKey: string) => {
    const entry = undoStack[editKey];
    if (!entry) return;
    const itemLabel = entry.kind === "feature" ? fName(entry.itemKey) : tName(entry.itemKey);

    setUndoing((s) => new Set(s).add(editKey));
    try {
      const { undoMinMonths } = await import("@/server/plan-matrix.functions");
      const res = await undoMinMonths({
        data: {
          plan_id: planId,
          item_key: entry.itemKey,
          kind: entry.kind,
          undo_to_value: entry.oldValue,
          expected_current_value: entry.newValue,
        },
      });

      if (res.conflict) {
        toast.warning(`Undo gagal: Nilai "${itemLabel}" sudah berubah lagi.`);
        setUndoStack((s) => { const n = { ...s }; delete n[editKey]; return n; });
        await load();
        return;
      }

      if (res.success) {
        toast.success(`Undo berhasil: "${itemLabel}" kembali ke ${entry.oldValue}`);
        setUndoStack((s) => { const n = { ...s }; delete n[editKey]; return n; });
        await load();
      } else {
        toast.error(`Undo gagal: ${res.error}`);
      }
    } catch (e) {
      toast.error(`[Undo Error] ${(e as Error).message}`);
    } finally {
      setUndoing((s) => { const n = new Set(s); n.delete(editKey); return n; });
    }
  };

  // ── Export ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const { fetchMatrixAuditLogs } = await import("@/server/plan-matrix.functions");
      const res = await fetchAuditFn({
        data: { planId, from: exportFrom, to: exportTo },
      });

      if (!res.success || !res.rows) {
        toast.error(`Gagal mengambil data audit: ${res.error}`);
        return;
      }

      if (res.rows.length === 0) {
        toast.info("Tidak ada data audit untuk periode ini.");
        return;
      }

      if (exportFormat === "csv") {
        downloadCSV(res.rows, `audit-matrix-${planName}-${exportFrom}-to-${exportTo}.csv`);
        toast.success("CSV berhasil diunduh");
      } else {
        const html = buildPdfHtml(res.rows, planName, exportFrom, exportTo);
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          win.print();
        }
      }
      setExportOpen(false);
    } catch (e) {
      toast.error(`Export error: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/plans" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Matrix Fitur & Tema</h1>
            <p className="text-sm text-muted-foreground">Plan: <span className="font-semibold text-foreground">{planName}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={exportOpen} onOpenChange={setExportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" /> Export Audit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Export Audit Log Matrix</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dari Tanggal</Label>
                    <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sampai Tanggal</Label>
                    <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV (Excel)</SelectItem>
                      <SelectItem value="pdf">PDF (Print-ready)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setExportOpen(false)}>Batal</Button>
                <Button onClick={handleExport} disabled={exporting} className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : exportFormat === "csv" ? <FileText className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  Generate {exportFormat.toUpperCase()}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={load}><Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>

      <Tabs defaultValue="features" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="features">Fitur Utama</TabsTrigger>
          <TabsTrigger value="themes">Tema Tampilan</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          {["core", "advanced", "integration", "addon"].map((cat) => (
            <Card key={cat} className="overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat}</div>
              <div className="divide-y divide-border">
                {features.filter((f) => f.category === cat).map((f) => (
                  <div key={f.key} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/20">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{f.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{f.key}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <MinMonthsEditor
                        editKey={`f-${f.key}`}
                        itemKey={f.key}
                        kind="feature"
                        currentVal={getFeatureMinMonths(f.key)}
                        editValue={monthEdits[`f-${f.key}`]}
                        inlineErr={monthErrors[`f-${f.key}`]}
                        status={savingStatus[`f-${f.key}`]}
                        undoEntry={undoStack[`f-${f.key}`]}
                        isUndoing={undoing.has(`f-${f.key}`)}
                        onEdit={handleMonthChange}
                        onSave={() => saveMinMonths(`f-${f.key}`, f.key, "feature")}
                        onUndo={() => undoChange(`f-${f.key}`)}
                        disabled={!isFeatureEnabled(f.key)}
                      />
                      <Switch
                        checked={isFeatureEnabled(f.key)}
                        onCheckedChange={(v) => toggleFeature(f.key, v)}
                        disabled={busyKeys.has(f.key)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="themes" className="space-y-4">
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {themes.map((t) => (
                <div key={t.key} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/20">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      {t.tier_hint && <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">{t.tier_hint}</Badge>}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">{t.key}</div>
                  </div>
                  <div className="flex items-center gap-6">
                    <MinMonthsEditor
                      editKey={`t-${t.key}`}
                      itemKey={t.key}
                      kind="theme"
                      currentVal={getThemeMinMonths(t.key)}
                      editValue={monthEdits[`t-${t.key}`]}
                      inlineErr={monthErrors[`t-${t.key}`]}
                      status={savingStatus[`t-${t.key}`]}
                      undoEntry={undoStack[`t-${t.key}`]}
                      isUndoing={undoing.has(`t-${t.key}`)}
                      onEdit={handleMonthChange}
                      onSave={() => saveMinMonths(`t-${t.key}`, t.key, "theme")}
                      onUndo={() => undoChange(`t-${t.key}`)}
                      disabled={!isThemeEnabled(t.key)}
                    />
                    <Switch
                      checked={isThemeEnabled(t.key)}
                      onCheckedChange={(v) => toggleTheme(t.key, v)}
                      disabled={busyKeys.has(t.key)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-component: MinMonthsEditor ──
function MinMonthsEditor({
  editKey, itemKey, kind, currentVal, editValue, inlineErr, status, undoEntry, isUndoing,
  onEdit, onSave, onUndo, disabled
}: {
  editKey: string; itemKey: string; kind: "feature" | "theme";
  currentVal: number; editValue?: string; inlineErr?: string;
  status: SavingStatus; undoEntry?: UndoEntry; isUndoing: boolean;
  onEdit: (k: string, v: string) => void; onSave: () => void; onUndo: () => void;
  disabled: boolean;
}) {
  const isSaving = !!status;
  const isDirty = editValue !== undefined && editValue !== String(currentVal);
  const canSave = isDirty && !inlineErr && !isSaving;

  return (
    <div className={`flex items-center gap-2 ${disabled ? "opacity-30 grayscale pointer-events-none" : ""}`}>
      <div className="flex flex-col items-end">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Min Bulan</span>
        <div className="text-xs font-bold tabular-nums">{currentVal}</div>
      </div>

      {!disabled && (
        <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 p-1">
          <div className="relative flex flex-col">
            <Input
              className={`h-7 w-14 px-1.5 text-center text-xs font-mono ${inlineErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
              value={editValue ?? currentVal}
              onChange={(e) => onEdit(editKey, e.target.value)}
              onKeyDown={(e) => { if (e.key === "." || e.key === ",") e.preventDefault(); }}
              min={0} max={120} step={1}
              disabled={isSaving}
            />
            {inlineErr && <span className="text-[10px] text-destructive mt-0.5 max-w-16 leading-tight">{inlineErr}</span>}
          </div>

          {/* Save button with status indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isDirty && !inlineErr ? "default" : "ghost"}
                  className="h-7 w-7"
                  disabled={!canSave}
                  onClick={onSave}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-0.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {status?.state === "retrying" && (
                        <span className="text-[9px] font-mono">{status.attempt}</span>
                      )}
                    </span>
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isSaving
                  ? status?.state === "retrying"
                    ? `Retry ${status.attempt}/2…`
                    : "Menyimpan…"
                  : isDirty
                    ? `Simpan: ${currentVal} → ${editValue}`
                    : "Tidak ada perubahan"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Undo button */}
          {undoEntry && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={isUndoing}
                    onClick={onUndo}
                  >
                    {isUndoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Undo: {undoEntry.newValue} → {undoEntry.oldValue}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}

// ── PDF HTML builder ──
function buildPdfHtml(
  rows: Array<Record<string, unknown>>,
  planName: string,
  from: string,
  to: string,
): string {
  const headers = ["tanggal", "event", "plan_name", "kind", "item_key", "old_value", "new_value", "actor_id"];
  const headerLabels: Record<string, string> = {
    tanggal: "Tanggal", event: "Event", plan_name: "Plan", kind: "Jenis",
    item_key: "Key", old_value: "Lama", new_value: "Baru", actor_id: "Actor",
  };
  const thCells = headers.map((h) => `<th style="border:1px solid #ddd;padding:6px 8px;text-align:left;background:#f5f5f5">${headerLabels[h] ?? h}</th>`).join("");
  const bodyRows = rows.map((r) => {
    const cells = headers.map((h) => `<td style="border:1px solid #ddd;padding:4px 8px;font-size:12px">${r[h] ?? ""}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit Matrix — ${planName}</title>
<style>body{font-family:system-ui,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}
@media print{button{display:none}}</style></head><body>
<h2>Audit Log Matrix: ${planName}</h2>
<p style="color:#666;font-size:13px">Periode: ${from} — ${to} | Total: ${rows.length} entri</p>
<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;
}
