import { createFileRoute, Link } from "@tanstack/react-router";
import { useEntitlements } from "@/lib/use-entitlements";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Lock, Palette } from "lucide-react";
import { toast } from "sonner";
import { setShopTheme } from "@/server/entitlements.functions";
import { useState } from "react";

export const Route = createFileRoute("/app/appearance")({ component: AppearancePage });

function AppearancePage() {
  const { entitlements, themes, activeThemeKey, planCode, monthsActive, loading, reload } = useEntitlements();
  const [busy, setBusy] = useState<string | null>(null);

  const apply = async (key: string) => {
    setBusy(key);
    try {

      await setShopTheme({ data: { themeKey: key } });
      toast.success("Tema diaktifkan");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex items-center gap-2">
        <Palette className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Tampilan Toko</h1>
      </div>
      <Card className="p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Paket aktif</div>
          <div className="text-lg font-bold uppercase">{planCode}</div>
          <div className="text-xs text-muted-foreground">{monthsActive.toFixed(1)} bulan berlangganan</div>
        </div>
        <Link to="/app/billing"><Button variant="outline" size="sm">Upgrade Paket</Button></Link>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => {
          const active = t.key === activeThemeKey;
          return (
            <Card key={t.key} className={`p-4 ${active ? "ring-2 ring-primary" : ""}`}>
              <div className="aspect-video rounded-lg bg-muted mb-3 overflow-hidden flex items-center justify-center text-muted-foreground text-xs">
                {t.preview_image_url ? <img src={t.preview_image_url} alt={t.name} className="h-full w-full object-cover" /> : t.name}
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{t.name}</h3>
                {active && <span className="text-xs text-primary inline-flex items-center gap-1"><Check className="h-3 w-3" />Aktif</span>}
                {!t.allowed && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
              {!t.allowed && t.reason && <p className="text-xs text-amber-700 mt-2">{t.reason}</p>}
              <div className="mt-3">
                {t.allowed ? (
                  <Button size="sm" disabled={active || busy === t.key} onClick={() => apply(t.key)}>
                    {busy === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? "Sedang dipakai" : "Pakai tema ini"}
                  </Button>
                ) : (
                  <Link to="/app/billing"><Button size="sm" variant="outline">Upgrade untuk akses</Button></Link>
                )}
              </div>
            </Card>
          );
        })}
        {themes.length === 0 && <p className="text-sm text-muted-foreground">Belum ada tema tersedia untuk paket ini.</p>}
      </div>

      {entitlements && (
        <>
          <h2 className="mt-10 mb-3 text-sm font-semibold text-muted-foreground">FITUR PAKET ANDA</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {entitlements.features.map((f) => (
              <div key={f.key} className="flex items-start gap-2 rounded border border-border bg-card p-3 text-sm">
                {f.allowed ? <Check className="h-4 w-4 text-emerald-600 mt-0.5" /> : <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />}
                <div>
                  <div className="font-medium">{f.name}</div>
                  {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                  {!f.allowed && f.reason && <div className="text-xs text-amber-700 mt-1">{f.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
