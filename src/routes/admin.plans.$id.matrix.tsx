import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
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
    setLoading(false);
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const isFeatureEnabled = (key: string) => pf.some((x) => x.feature_key === key);
  const isThemeEnabled = (key: string) => pt.some((x) => x.theme_key === key);
  const getFeatureMinMonths = (key: string) => pf.find((x) => x.feature_key === key)?.requires_min_months ?? 0;
  const getThemeMinMonths = (key: string) => pt.find((x) => x.theme_key === key)?.requires_min_months ?? 0;

  const [busy, setBusy] = useState<string | null>(null);

  const toggleFeature = async (key: string, enabled: boolean) => {
    if (busy) return;
    if (enabled && isFeatureEnabled(key)) { toast.info("Fitur ini sudah aktif untuk plan ini"); return; }
    setBusy(key);
    try {
      if (enabled) {
        const { error } = await supabase.from("plan_features").insert({ plan_id: planId, feature_key: key });
        if (error) {
          if (error.code === "23505") toast.error("Fitur sudah terdaftar (duplikat)");
          else toast.error(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("plan_features").delete().eq("plan_id", planId).eq("feature_key", key);
        if (error) { toast.error(error.message); return; }
      }
      await load();
    } finally { setBusy(null); }
  };

  const toggleTheme = async (key: string, enabled: boolean) => {
    if (busy) return;
    if (enabled && isThemeEnabled(key)) { toast.info("Tema ini sudah aktif untuk plan ini"); return; }
    setBusy(key);
    try {
      if (enabled) {
        const { error } = await supabase.from("plan_themes").insert({ plan_id: planId, theme_key: key });
        if (error) {
          if (error.code === "23505") toast.error("Tema sudah terdaftar (duplikat)");
          else toast.error(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("plan_themes").delete().eq("plan_id", planId).eq("theme_key", key);
        if (error) { toast.error(error.message); return; }
      }
      await load();
    } finally { setBusy(null); }
  };

  const validateMinMonths = (value: number): string | null => {
    if (!Number.isInteger(value)) return "Harus bilangan bulat";
    if (value < 0) return "Tidak boleh negatif";
    if (value > 120) return "Maksimal 120 bulan";
    return null;
  };

  const updateFeatureMinMonths = async (key: string, raw: string) => {
    const months = Number(raw);
    if (Number.isNaN(months)) { toast.error("Masukkan angka yang valid"); return; }
    const err = validateMinMonths(months);
    if (err) { toast.error(err); return; }
    const current = getFeatureMinMonths(key);
    if (months === current) return;
    const { error } = await supabase.from("plan_features").update({ requires_min_months: months }).eq("plan_id", planId).eq("feature_key", key);
    if (error) toast.error(error.message);
    else { toast.success("Tersimpan"); load(); }
  };

  const updateThemeMinMonths = async (key: string, raw: string) => {
    const months = Number(raw);
    if (Number.isNaN(months)) { toast.error("Masukkan angka yang valid"); return; }
    const err = validateMinMonths(months);
    if (err) { toast.error(err); return; }
    const current = getThemeMinMonths(key);
    if (months === current) return;
    const { error } = await supabase.from("plan_themes").update({ requires_min_months: months }).eq("plan_id", planId).eq("theme_key", key);
    if (error) toast.error(error.message);
    else { toast.success("Tersimpan"); load(); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const grouped = features.reduce<Record<string, Feature[]>>((acc, f) => { (acc[f.category] ??= []).push(f); return acc; }, {});

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
                  return (
                    <div key={f.key} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 flex-1">
                        <Switch checked={on} disabled={busy !== null} onCheckedChange={(v) => toggleFeature(f.key, v)} />
                        <span className="text-sm font-medium">{f.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{f.key}</span>
                      </div>
                      {on && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Min bulan:</span>
                          <Input type="number" className="w-16 h-7 text-xs" defaultValue={getFeatureMinMonths(f.key)} onBlur={(e) => updateFeatureMinMonths(f.key, e.target.value)} min={0} max={120} />
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
                return (
                  <div key={t.key} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3 flex-1">
                      <Switch checked={on} disabled={busy !== null} onCheckedChange={(v) => toggleTheme(t.key, v)} />
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{t.key}</span>
                      {t.tier_hint && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.tier_hint}</span>}
                    </div>
                    {on && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Min bulan:</span>
                        <Input type="number" className="w-16 h-7 text-xs" defaultValue={getThemeMinMonths(t.key)} onBlur={(e) => updateThemeMinMonths(t.key, e.target.value)} min={0} max={120} />
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
