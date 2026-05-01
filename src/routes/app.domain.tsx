import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { usePlan } from "@/lib/use-plan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Globe, Lock, Loader2, CheckCircle2, AlertTriangle, Copy, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/domain")({
  component: DomainPage,
});

type DomainState = {
  custom_domain: string | null;
  custom_domain_verify_token: string | null;
  custom_domain_verified_at: string | null;
};

function DomainPage() {
  const { shop } = useCurrentShop();
  const { isPro, loading: planLoading } = usePlan();
  const [state, setState] = useState<DomainState | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Array<{ id: string; action: string; new_domain: string | null; created_at: string }>>([]);
  const [cnameTarget, setCnameTarget] = useState<string>("tenants.kopihub.app");
  const [lastCheck, setLastCheck] = useState<{ verified: boolean; cnameOk: boolean; sslOk?: boolean; sslError?: string | null; txtValues: string[] } | null>(null);

  const reload = async () => {
    if (!shop) return;
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("coffee_shops").select("custom_domain, custom_domain_verify_token, custom_domain_verified_at").eq("id", shop.id).maybeSingle(),
      supabase.from("domain_audit").select("id, action, new_domain, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(10),
    ]);
    setState(s as DomainState | null);
    setAudit((a as Array<{ id: string; action: string; new_domain: string | null; created_at: string }>) ?? []);
  };

  useEffect(() => { reload(); }, [shop]);

  if (planLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (!isPro) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <Card className="p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Fitur Pro</h1>
          <p className="mt-2 text-sm text-muted-foreground">Custom domain hanya tersedia untuk paket Pro. Hubungkan domain milik Anda sendiri ke etalase publik.</p>
          <Link to="/app/billing" className="mt-4 inline-block">
            <Button>Lihat Paket Pro</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { requestCustomDomain } = await import("@/server/domain.functions");
      await requestCustomDomain({ data: { domain: domainInput.trim().toLowerCase() } });
      toast.success("Domain disimpan. Atur DNS sesuai instruksi lalu verifikasi.");
      setDomainInput("");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const onVerify = async () => {
    setBusy(true);
    try {
      const { verifyCustomDomain } = await import("@/server/domain.functions");
      const r = await verifyCustomDomain();
      setLastCheck({ verified: r.verified, cnameOk: r.cnameOk, sslOk: r.sslOk, sslError: r.sslError, txtValues: r.txtValues });
      if (r.cnameTarget) setCnameTarget(r.cnameTarget);
      if (r.verified) {
        if (r.cnameOk && r.sslOk) toast.success("Domain aktif: TXT, CNAME & SSL OK!");
        else if (r.cnameOk) toast.success("TXT & CNAME OK. SSL sedang di-issue (1–10 menit).");
        else toast.success("TXT terverifikasi. CNAME belum aktif — trafik belum diarahkan.");
      }
      else toast.error("TXT record belum ditemukan. Tunggu propagasi DNS lalu coba lagi.");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const onRemove = async () => {
    if (!confirm("Hapus custom domain?")) return;
    setBusy(true);
    try {
      const { removeCustomDomain } = await import("@/server/domain.functions");
      await removeCustomDomain();
      toast.success("Domain dihapus");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Disalin"); };
  const verified = !!state?.custom_domain_verified_at;
  const txtName = state?.custom_domain ? `_kopihub-verify.${state.custom_domain}` : "";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex items-center gap-2">
        <Globe className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Domain Kustom</h1>
      </div>

      {!state?.custom_domain ? (
        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-3">
            <Label>Domain Anda</Label>
            <Input placeholder="contoh: kopiku.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} required />
            <p className="text-xs text-muted-foreground">Masukkan domain tanpa http:// atau www.</p>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hubungkan Domain"}</Button>
          </form>
        </Card>
      ) : (
        <>
          {(() => {
            const lastAuto = audit.find((a) => a.action === "auto_unverify");
            if (!verified && lastAuto) {
              return (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                  <b>Domain otomatis dinonaktifkan</b> — pemeriksaan DNS terakhir gagal pada {new Date(lastAuto.created_at).toLocaleString("id-ID")}. Pastikan record DNS Anda masih aktif lalu klik <i>Cek Verifikasi</i>.
                </div>
              );
            }
            return null;
          })()}
          <Card className="p-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Domain</div>
                <div className="text-xl font-bold">{state.custom_domain}</div>
                <div className="mt-1">
                  {verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 text-green-700 px-2 py-0.5 text-xs font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Terverifikasi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 px-2 py-0.5 text-xs font-medium">
                      <AlertTriangle className="h-3 w-3" /> Menunggu verifikasi
                    </span>
                  )}
                </div>
                {verified && (
                  <a href={`https://${state.custom_domain}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">
                    Buka https://{state.custom_domain}
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onVerify} disabled={busy}>Cek DNS & SSL</Button>
                <Button variant="outline" size="icon" onClick={onRemove} disabled={busy}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {verified && lastCheck && (
              <div className="mt-3 rounded border border-border p-3 text-xs space-y-1">
                <div>CNAME mengarah ke proxy: <b className={lastCheck.cnameOk ? "text-green-700" : "text-amber-700"}>{lastCheck.cnameOk ? "Ya" : "Belum"}</b></div>
                <div>SSL/HTTPS aktif: <b className={lastCheck.sslOk ? "text-green-700" : "text-amber-700"}>{lastCheck.sslOk ? "Ya" : "Belum"}</b>{lastCheck.sslError && <span className="ml-1 text-muted-foreground">({lastCheck.sslError})</span>}</div>
              </div>
            )}
          </Card>

          {!verified && (
            <Card className="mt-4 p-5">
              <div className="text-sm font-semibold mb-3">Instruksi DNS</div>
              <p className="text-xs text-muted-foreground mb-3">Tambahkan dua record berikut di pengelola DNS domain Anda. Verifikasi bisa diklik setelah propagasi (biasanya 1–60 menit).</p>

              <div className="space-y-3">
                <div className="rounded border border-border p-3 text-xs">
                  <div className="font-semibold mb-1">1. TXT (verifikasi kepemilikan)</div>
                  <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
                    <span className="text-muted-foreground">Type</span><code>TXT</code><span />
                    <span className="text-muted-foreground">Name</span><code className="break-all">{txtName}</code><button onClick={() => copy(txtName)}><Copy className="h-3 w-3" /></button>
                    <span className="text-muted-foreground">Value</span><code className="break-all">{state.custom_domain_verify_token}</code><button onClick={() => copy(state.custom_domain_verify_token ?? "")}><Copy className="h-3 w-3" /></button>
                  </div>
                </div>

                <div className="rounded border border-border p-3 text-xs">
                  <div className="font-semibold mb-1">2. CNAME (mengarahkan trafik)</div>
                  <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
                    <span className="text-muted-foreground">Type</span><code>CNAME</code><span />
                    <span className="text-muted-foreground">Name</span><code>@ atau www</code><span />
                    <span className="text-muted-foreground">Value</span><code className="break-all">{cnameTarget}</code><button onClick={() => copy(cnameTarget)}><Copy className="h-3 w-3" /></button>
                  </div>
                  <p className="mt-2 text-muted-foreground">Beberapa registrar tidak mendukung CNAME di root (@). Gunakan ALIAS/ANAME bila tersedia, atau pakai subdomain seperti <code>www</code> / <code>toko</code>.</p>
                </div>
              </div>
              {lastCheck && (
                <div className="mt-3 rounded border border-border p-3 text-xs space-y-1">
                  <div>TXT terverifikasi: <b className={lastCheck.verified ? "text-green-700" : "text-red-700"}>{lastCheck.verified ? "Ya" : "Belum"}</b></div>
                  <div>CNAME mengarah ke proxy: <b className={lastCheck.cnameOk ? "text-green-700" : "text-amber-700"}>{lastCheck.cnameOk ? "Ya" : "Belum"}</b></div>
                  <div>SSL/HTTPS aktif: <b className={lastCheck.sslOk ? "text-green-700" : "text-amber-700"}>{lastCheck.sslOk ? "Ya" : "Belum"}</b>{lastCheck.sslError && <span className="ml-1 text-muted-foreground">({lastCheck.sslError})</span>}</div>
                  {lastCheck.txtValues.length > 0 && <div className="text-muted-foreground">Nilai TXT terdeteksi: {lastCheck.txtValues.join(", ")}</div>}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <h2 className="mt-8 mb-2 text-sm font-semibold text-muted-foreground">RIWAYAT</h2>
      <div className="space-y-2">
        {audit.length === 0 && <div className="text-sm text-muted-foreground">Belum ada aktivitas.</div>}
        {audit.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-border bg-card px-3 py-2 text-xs">
            <span><b className="uppercase">{a.action}</b> {a.new_domain ?? ""}</span>
            <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("id-ID")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
