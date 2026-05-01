import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/plans/$id/matrix")({ component: PlanMatrix });

type Feature = { key: string; name: string; category: string };
type Theme = { key: string; name: string; tier_hint: string | null };
type PlanFeature = { plan_id: string; feature_key: string; requires_min_months: number | null; limit_value: number | null };
type PlanTheme = { plan_id: string; theme_key: string; requires_min_months: number | null };

function PlanMatrix() {
  const { id: planId } = Route.useParams();
  const [planName, setPlanName] = useState("");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [pf, setPf] = useState<PlanFeature[]>([]);
  const [pt, setPt] = useState<PlanTheme[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-row busy state (Set of keys currently processing)
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const markBusy = (key: string) => setBusyKeys((s) => new Set(s).add(key));
  const clearBusy = (key: string) => setBusyKeys((s) => { const n = new Set(s); n.delete(key); return n; });

  // Local edits for min_months (key → string value)
  const [monthEdits, setMonthEdits] = useState<Record<string, string>>({});
  const [monthSaving, setMonthSaving] = useState<Set<string>>(new Set());

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
    setLoading(false);
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const isFeatureEnabled = (key: string) => pf.some((x) => x.feature_key === key);
  const isThemeEnabled = (key: string) => pt.some((x) => x.theme_key === key);
  const getFeatureMinMonths = (key: string) => pf.find((x) => x.feature_key === key)?.requires_min_months ?? 0;
  const getThemeMinMonths = (key: string) => pt.find((x) => x.theme_key === key)?.requires_min_months ?? 0;

  const featureName = (key: string) => features.find((f) => f.key === key)?.name ?? key;
  const themeName = (key: string) => themes.find((t) => t.key === key)?.name ?? key;

  const describeError = (code: string | undefined, message: string, itemLabel: string) => {
    if (code === "23505") return `"${itemLabel}" sudah terdaftar di plan "${planName}" (duplikat)`;
    if (message.includes("requires_min_months must be between"))
      return `Min bulan untuk "${itemLabel}" di plan "${planName}" harus antara 0–120`;
    if (message.includes("requires_min_months must be an integer"))
      return `Min bulan untuk "${itemLabel}" di plan "${planName}" harus bilangan bulat`;
    return message;
  };

  // ── Toggle Feature ──
  const toggleFeature = async (key: string, enabled: boolean) => {
    if (busyKeys.has(key)) return;
    if (enabled && isFeatureEnabled(key)) {
      toast.info(`Fitur "${featureName(key)}" sudah aktif di plan "${planName}"`);
      return;
    }
    markBusy(key);
    try {
      if (enabled) {
        const { error } = await supabase.from("plan_features").insert({ plan_id: planId, feature_key: key });
        if (error) { toast.error(describeError(error.code, error.message, featureName(key))); return; }
        toast.success(`Fitur "${featureName(key)}" diaktifkan untuk plan "${planName}"`);
      } else {
        const { error } = await supabase.from("plan_features").delete().eq("plan_id", planId).eq("feature_key", key);
        if (error) { toast.error(error.message); return; }
        toast.success(`Fitur "${featureName(key)}" dinonaktifkan dari plan "${planName}"`);
      }
      await load();
    } finally { clearBusy(key); }
  };

  // ── Toggle Theme ──
  const toggleTheme = async (key: string, enabled: boolean) => {
    if (busyKeys.has(key)) return;
    if (enabled && isThemeEnabled(key)) {
      toast.info(`Tema "${themeName(key)}" sudah aktif di plan "${planName}"`);
      return;
    }
    markBusy(key);
    try {
      if (enabled) {
        const { error } = await supabase.from("plan_themes").insert({ plan_id: planId, theme_key: key });
        if (error) { toast.error(describeError(error.code, error.message, themeName(key))); return; }
        toast.success(`Tema "${themeName(key)}" diaktifkan untuk plan "${planName}"`);
      } else {
        const { error } = await supabase.from("plan_themes").delete().eq("plan_id", planId).eq("theme_key", key);
        if (error) { toast.error(error.message); return; }
        toast.success(`Tema "${themeName(key)}" dinonaktifkan dari plan "${planName}"`);
      }
      await load();
    } finally { clearBusy(key); }
  };

  // ── Validate min months (client-side) ──
  const validateMinMonths = (raw: string): { valid: false; msg: string } | { valid: true; value: number } => {
    const n = Number(raw);
    if (raw.trim() === "" || Number.isNaN(n)) return { valid: false, msg: "Masukkan angka yang valid" };
    if (!Number.isInteger(n)) return { valid: false, msg: "Harus bilangan bulat" };
    if (n < 0) return { valid: false, msg: "Tidak boleh negatif" };
    if (n > 120) return { valid: false, msg: "Maksimal 120 bulan" };
    return { valid: true, value: n };
  };

  // ── Save Feature Min Months (explicit button) ──
  const saveFeatureMinMonths = async (key: string) => {
    const raw = monthEdits[`f:${key}`];
    if (raw === undefined) return; // nothing edited
    const result = validateMinMonths(raw);
    if (!result.valid) { toast.error(`${featureName(key)}: ${result.msg}`); return; }
    const current = getFeatureMinMonths(key);
    if (result.value === current) { toast.info("Nilai tidak berubah"); return; }
    setMonthSaving((s) => new Set(s).add(`f:${key}`));
    try {
      const { error } = await supabase.from("plan_features").update({ requires_min_months: result.value }).eq("plan_id", planId).eq("feature_key", key);
      if (error) { toast.error(describeError(error.code, error.message, featureName(key))); return; }
      toast.success(`Min bulan "${featureName(key)}" di plan "${planName}" → ${result.value}`);
      await load();
    } finally { setMonthSaving((s) => { const n = new Set(s); n.delete(`f:${key}`); return n; }); }
  };

  // ── Save Theme Min Months (explicit button) ──
  const saveThemeMinMonths = async (key: string) => {
    const raw = monthEdits[`t:${key}`];
    if (raw === undefined) return;
    const result = validateMinMonths(raw);
    if (!result.valid) { toast.error(`${themeName(key)}: ${result.msg}`); return; }
    const current = getThemeMinMonths(key);
    if (result.value === current) { toast.info("Nilai tidak berubah"); return; }
    setMonthSaving((s) => new Set(s).add(`t:${key}`));
    try {
      const { error } = await supabase.from("plan_themes").update({ requires_min_months: result.value }).eq("plan_id", planId).eq("theme_key", key);
      if (error) { toast.error(describeError(error.code, error.message, themeName(key))); return; }
      toast.success(`Min bulan "${themeName(key)}" di plan "${planName}" → ${result.value}`);
      await load();
    } finally { setMonthSaving((s) => { const n = new Set(s); n.delete(`t:${key}`); return n; }); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const grouped = features.reduce<Record<string, Feature[]>>((acc, f) => { (acc[f.category] ??= []).push(f); return acc; }, {});

  const hasEdit = (editKey: string, currentVal: number) => {
    const raw = monthEdits[editKey];
    return raw !== undefined && Number(raw) !== currentVal;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/plans"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Matrix: {planName}</h1>
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
                {items.map((f) => {
                  const on = isFeatureEnabled(f.key);
                  const isBusy = busyKeys.has(f.key);
                  const editKey = `f:${f.key}`;
                  const currentVal = getFeatureMinMonths(f.key);
                  const dirty = hasEdit(editKey, currentVal);
                  const saving = monthSaving.has(editKey);
                  return (
                    <div key={f.key} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Switch checked={on} disabled={isBusy} onCheckedChange={(v) => toggleFeature(f.key, v)} />
                        {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                        <span className="text-sm font-medium truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{f.key}</span>
                      </div>
                      {on && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">Min bulan:</span>
                          <Input
                            type="number"
                            className="w-16 h-7 text-xs"
                            value={monthEdits[editKey] ?? String(currentVal)}
                            onChange={(e) => setMonthEdits((m) => ({ ...m, [editKey]: e.target.value }))}
                            min={0} max={120}
                          />
                          <Button
                            size="icon"
                            variant={dirty ? "default" : "ghost"}
                            className="h-7 w-7"
                            disabled={saving || !dirty}
                            onClick={() => saveFeatureMinMonths(f.key)}
                          >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="themes" className="mt-4">
          <Card className="p-4">
            <div className="space-y-2">
              {themes.map((t) => {
                const on = isThemeEnabled(t.key);
                const isBusy = busyKeys.has(t.key);
                const editKey = `t:${t.key}`;
                const currentVal = getThemeMinMonths(t.key);
                const dirty = hasEdit(editKey, currentVal);
                const saving = monthSaving.has(editKey);
                return (
                  <div key={t.key} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Switch checked={on} disabled={isBusy} onCheckedChange={(v) => toggleTheme(t.key, v)} />
                      {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                      <span className="text-sm font-medium truncate">{t.name}</span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">{t.key}</span>
                      {t.tier_hint && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.tier_hint}</span>}
                    </div>
                    {on && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">Min bulan:</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs"
                          value={monthEdits[editKey] ?? String(currentVal)}
                          onChange={(e) => setMonthEdits((m) => ({ ...m, [editKey]: e.target.value }))}
                          min={0} max={120}
                        />
                        <Button
                          size="icon"
                          variant={dirty ? "default" : "ghost"}
                          className="h-7 w-7"
                          disabled={saving || !dirty}
                          onClick={() => saveThemeMinMonths(t.key)}
                        >
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
