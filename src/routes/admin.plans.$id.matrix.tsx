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
// import { updateMinMonths, undoMinMonths, fetchMatrixAuditLogs } from "@/server/plan-matrix.functions";
import { useServerFn } from "@tanstack/react-start";
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

  const [fns, setFns] = useState<{
    updateMinMonths: typeof import("@/server/plan-matrix.functions").updateMinMonths;
    undoMinMonths: typeof import("@/server/plan-matrix.functions").undoMinMonths;
    fetchMatrixAuditLogs: typeof import("@/server/plan-matrix.functions").fetchMatrixAuditLogs;
  } | null>(null);

  useEffect(() => {
    import("@/server/plan-matrix.functions").then(setFns);
  }, []);

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exporting, setExporting] = useState(false);

  const updateMinMonthsFn = useServerFn(fns?.updateMinMonths || (async () => ({} as any)));
  const undoMinMonthsFn = useServerFn(fns?.undoMinMonths || (async () => ({} as any)));
  const fetchAuditFn = useServerFn(fns?.fetchMatrixAuditLogs || (async () => ({} as any)));

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
      const res = await updateMinMonthsFn({
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
          { description: res.message ?? "Nilai berubah oleh pengguna lain. Data dimuat ulang.", duration: 6000 },
        );
        await load();
        return;
      }

      if (res.changed) {
        // Push to undo stack
        setUndoStack((s) => ({
          ...s,
          [editKey]: { editKey, itemKey, kind, oldValue: res.old_value, newValue: res.new_value },
        }));

        const retryNote = (res as any).retries_used > 0 ? ` (retry ${(res as any).retries_used}×)` : "";
        toast.success(
          `${itemLabel} [${planName}]: ${res.old_value} → ${res.new_value}${retryNote}`,
          { description: "Dicatat ke audit log" },
        );
      } else {
        toast.info("Nilai tidak berubah (sudah sesuai di server)");
      }
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      toast.error(`[${planName} / ${itemLabel}] ${msg}`);
    } finally {
      setSavingStatus((s) => { const n = { ...s }; delete n[editKey]; return n; });
    }
  };

  // ── Undo last change ──
  const handleUndo = async (editKey: string) => {
    const entry = undoStack[editKey];
    if (!entry) return;
    const itemLabel = entry.kind === "feature" ? fName(entry.itemKey) : tName(entry.itemKey);

    setUndoing((s) => new Set(s).add(editKey));
    try {
      const res = await undoMinMonthsFn({
        data: {
          plan_id: planId,
          item_key: entry.itemKey,
          kind: entry.kind,
          restore_value: entry.oldValue,
          expected_current: entry.newValue,
        },
      });

      if (res.conflict) {
        toast.warning(`Undo gagal: ${itemLabel} [${planName}]`, {
          description: res.message ?? "Nilai telah berubah lagi.",
        });
        await load();
        return;
      }

      if (res.changed) {
        toast.success(`Undo: ${itemLabel} [${planName}]: ${entry.newValue} → ${entry.oldValue}`, {
          description: "Dicatat ke audit log",
        });
        // Remove from undo stack
        setUndoStack((s) => { const n = { ...s }; delete n[editKey]; return n; });
      }
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal undo";
      toast.error(`[${planName} / ${itemLabel}] ${msg}`);
    } finally {
      setUndoing((s) => { const n = new Set(s); n.delete(editKey); return n; });
    }
  };

  // ── Export audit logs ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchAuditFn({
        data: { plan_id: planId, from_date: exportFrom, to_date: exportTo },
      });

      if (!rows || rows.length === 0) {
        toast.info("Tidak ada log untuk periode ini");
        setExporting(false);
        return;
      }

      if (exportFormat === "csv") {
        downloadCSV(`audit-matrix-${planName}-${exportFrom}-${exportTo}.csv`, rows);
        toast.success(`${rows.length} baris diekspor ke CSV`);
      } else {
        // PDF: generate printable HTML and trigger print
        const html = buildPdfHtml(rows, planName, exportFrom, exportTo);
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(html);
          w.document.close();
          w.onload = () => { w.print(); };
        }
        toast.success(`${rows.length} baris disiapkan untuk PDF/print`);
      }
      setExportOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal ekspor");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const grouped = features.reduce<Record<string, Feature[]>>((acc, f) => { (acc[f.category] ??= []).push(f); return acc; }, {});

  const isDirty = (editKey: string, currentVal: number) => {
    const raw = monthEdits[editKey];
    return raw !== undefined && Number(raw) !== currentVal;
  };

  const canSave = (editKey: string, currentVal: number) =>
    isDirty(editKey, currentVal) && !monthErrors[editKey] && !savingStatus[editKey];

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin/plans"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <h1 className="text-2xl font-bold">Matrix: {planName}</h1>
          </div>
          <Dialog open={exportOpen} onOpenChange={setExportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" />Ekspor Audit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Ekspor Audit Log Matrix</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Dari</Label><Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} /></div>
                  <div><Label>Sampai</Label><Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} /></div>
                </div>
                <div>
                  <Label>Format</Label>
                  <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "csv" | "pdf")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf">PDF (Print)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleExport} disabled={exporting} className="w-full">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <FileText className="h-4 w-4 mr-1.5" />}
                  Ekspor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="features">
          <TabsList>
            <TabsTrigger value="features">Fitur</TabsTrigger>
            <TabsTrigger value="themes">Tema</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-4 mt-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <Card key={cat} className="p-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase mb-3">{cat}</h3>
                <div className="space-y-2">
                  {items.map((f) => (
                    <MatrixRow
                      key={f.key}
                      itemKey={f.key}
                      itemName={f.name}
                      kind="feature"
                      enabled={isFeatureEnabled(f.key)}
                      isBusy={busyKeys.has(f.key)}
                      currentVal={getFeatureMinMonths(f.key)}
                      editKey={`f:${f.key}`}
                      editValue={monthEdits[`f:${f.key}`]}
                      inlineErr={monthErrors[`f:${f.key}`]}
                      status={savingStatus[`f:${f.key}`] ?? null}
                      undoEntry={undoStack[`f:${f.key}`] ?? null}
                      isUndoing={undoing.has(`f:${f.key}`)}
                      isDirty={isDirty(`f:${f.key}`, getFeatureMinMonths(f.key))}
                      canSave={canSave(`f:${f.key}`, getFeatureMinMonths(f.key))}
                      onToggle={(v) => toggleFeature(f.key, v)}
                      onMonthChange={(raw) => handleMonthChange(`f:${f.key}`, raw)}
                      onSave={() => saveMinMonths(`f:${f.key}`, f.key, "feature")}
                      onUndo={() => handleUndo(`f:${f.key}`)}
                    />
                  ))}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="themes" className="mt-4">
            <Card className="p-4">
              <div className="space-y-2">
                {themes.map((t) => (
                  <MatrixRow
                    key={t.key}
                    itemKey={t.key}
                    itemName={t.name}
                    kind="theme"
                    tierHint={t.tier_hint}
                    enabled={isThemeEnabled(t.key)}
                    isBusy={busyKeys.has(t.key)}
                    currentVal={getThemeMinMonths(t.key)}
                    editKey={`t:${t.key}`}
                    editValue={monthEdits[`t:${t.key}`]}
                    inlineErr={monthErrors[`t:${t.key}`]}
                    status={savingStatus[`t:${t.key}`] ?? null}
                    undoEntry={undoStack[`t:${t.key}`] ?? null}
                    isUndoing={undoing.has(`t:${t.key}`)}
                    isDirty={isDirty(`t:${t.key}`, getThemeMinMonths(t.key))}
                    canSave={canSave(`t:${t.key}`, getThemeMinMonths(t.key))}
                    onToggle={(v) => toggleTheme(t.key, v)}
                    onMonthChange={(raw) => handleMonthChange(`t:${t.key}`, raw)}
                    onSave={() => saveMinMonths(`t:${t.key}`, t.key, "theme")}
                    onUndo={() => handleUndo(`t:${t.key}`)}
                  />
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

// ── Extracted Row Component ──
function MatrixRow({
  itemKey, itemName, kind, tierHint, enabled, isBusy, currentVal,
  editKey, editValue, inlineErr, status, undoEntry, isUndoing,
  isDirty, canSave,
  onToggle, onMonthChange, onSave, onUndo,
}: {
  itemKey: string; itemName: string; kind: "feature" | "theme"; tierHint?: string | null;
  enabled: boolean; isBusy: boolean; currentVal: number;
  editKey: string; editValue: string | undefined; inlineErr: string | undefined;
  status: SavingStatus; undoEntry: UndoEntry | null; isUndoing: boolean;
  isDirty: boolean; canSave: boolean;
  onToggle: (v: boolean) => void; onMonthChange: (raw: string) => void;
  onSave: () => void; onUndo: () => void;
}) {
  const isSaving = status !== null;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Switch checked={enabled} disabled={isBusy} onCheckedChange={onToggle} />
        {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        <span className="text-sm font-medium truncate">{itemName}</span>
        <span className="text-xs text-muted-foreground font-mono shrink-0">{itemKey}</span>
        {kind === "theme" && tierHint && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tierHint}</span>
        )}
      </div>
      {enabled && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">Min bulan:</span>
          <div className="flex flex-col">
            <Input
              type="number"
              className={`w-16 h-7 text-xs ${inlineErr ? "border-destructive" : ""}`}
              value={editValue ?? String(currentVal)}
              onChange={(e) => onMonthChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "." || e.key === ",") e.preventDefault(); }}
              min={0} max={120} step={1}
              disabled={isSaving}
            />
            {inlineErr && <span className="text-[10px] text-destructive mt-0.5 max-w-16 leading-tight">{inlineErr}</span>}
          </div>

          {/* Save button with status indicator */}
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

          {/* Undo button */}
          {undoEntry && (
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
