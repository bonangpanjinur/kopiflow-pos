import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { usePlan } from "@/lib/use-plan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { Loader2, Upload, CheckCircle2, Clock, XCircle, Copy, Eye } from "lucide-react";

export const Route = createFileRoute("/app/billing")({
  component: BillingPage,
});

type Plan = { id: string; code: string; name: string; price_idr: number; duration_days: number; features: Record<string, unknown> };
type Invoice = {
  id: string;
  invoice_no: string;
  amount_idr: number;
  status: string;
  payment_proof_url: string | null;
  created_at: string;
  notes: string | null;
  plans: { name: string } | null;
};
type BillingSettings = { bank_name: string | null; account_no: string | null; account_name: string | null; instructions: string | null; qris_image_url: string | null };

function BillingPage() {
  const { shop } = useCurrentShop();
  const { plan, expiresAt, isPro } = usePlan();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    if (!shop) return;
    const [{ data: ps }, { data: invs }, { data: bs }] = await Promise.all([
      supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("plan_invoices").select("id, invoice_no, amount_idr, status, payment_proof_url, created_at, notes, plans(name)").eq("shop_id", shop.id).order("created_at", { ascending: false }),
      supabase.rpc("get_billing_settings_public"),
    ]);
    setPlans((ps as Plan[]) ?? []);
    setInvoices((invs as unknown as Invoice[]) ?? []);
    const row = Array.isArray(bs) ? (bs[0] ?? null) : null;
    setSettings(row as BillingSettings | null);
  };

  useEffect(() => { reload(); }, [shop]);

  const onUpgrade = async (planCode: string) => {
    setBusy(planCode);
    try {
      const { createPlanInvoice } = await import("@/server/billing.functions");
      await createPlanInvoice({ data: { planCode } });
      toast.success("Tagihan dibuat. Lakukan pembayaran lalu upload bukti.");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onUploadProof = async (inv: Invoice, file: File) => {
    if (!shop) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File maks 5MB"); return; }
    setBusy(inv.id);
    try {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${shop.id}/${inv.invoice_no}-${Date.now()}.${ext || "bin"}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      
      // Store the storage path (not a signed URL) so admin & owner can re-sign on demand.
      const { submitPaymentProof } = await import("@/server/billing.functions");
      await submitPaymentProof({ data: { invoiceId: inv.id, proofUrl: path } });
      toast.success("Bukti terkirim. Menunggu review super admin.");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onCancel = async (inv: Invoice) => {
    if (!confirm(`Batalkan tagihan ${inv.invoice_no}?`)) return;
    setBusy(inv.id);
    try {
      const { cancelPlanInvoice } = await import("@/server/billing.functions");
      await cancelPlanInvoice({ data: { invoiceId: inv.id } });
      toast.success("Tagihan dibatalkan");
      await reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const onViewProof = async (inv: Invoice) => {
    try {
      const { getProofSignedUrl } = await import("@/server/billing.functions");
      const { url } = await getProofSignedUrl({ data: { invoiceId: inv.id } });
      if (url) window.open(url, "_blank"); else toast.error("Bukti tidak tersedia");
    } catch (e) { toast.error((e as Error).message); }
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Disalin"); };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Plan & Tagihan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pilih paket berlangganan dan kelola pembayaran.</p>
      </div>

      {(() => {
        if (!expiresAt || !isPro) return null;
        const days = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (days > 7) return null;
        const expired = days <= 0;
        return (
          <div className={`mb-4 rounded-lg border p-3 text-sm ${expired ? "border-red-500/30 bg-red-500/10 text-red-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}`}>
            <b>{expired ? "Paket Pro telah kadaluarsa" : `Paket Pro berakhir dalam ${days} hari`}</b>
            <span className="ml-1">{expired ? "— fitur Pro otomatis dinonaktifkan. Perbarui sekarang." : "— perpanjang sebelum kadaluarsa agar tidak terputus."}</span>
          </div>
        );
      })()}

      <Card className="mb-6 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Paket aktif</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold uppercase">{plan}</span>
              {isPro && <Badge className="bg-primary">PRO</Badge>}
            </div>
            {expiresAt && (
              <div className="mt-1 text-xs text-muted-foreground">
                Berlaku hingga {expiresAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">PILIH PAKET</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.duration_days} hari</div>
              </div>
              <div className="text-2xl font-bold tabular-nums">{formatIDR(p.price_idr)}</div>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {Object.entries(p.features).map(([k, v]) => v ? <li key={k}>✓ {k.replace(/_/g, " ")}</li> : null)}
            </ul>
            <Button className="mt-4 w-full" onClick={() => onUpgrade(p.code)} disabled={busy === p.code}>
              {busy === p.code ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade ke " + p.name}
            </Button>
          </Card>
        ))}
      </div>

      {settings && (settings.bank_name || settings.account_no || settings.qris_image_url) && (
        <Card className="mt-6 p-5">
          <div className="text-sm font-semibold mb-2">Cara Pembayaran</div>
          {(settings.bank_name || settings.account_no) && (
            <div className="space-y-1 text-sm">
              {settings.bank_name && <div>Bank: <b>{settings.bank_name}</b></div>}
              {settings.account_no && (
                <div className="flex items-center gap-2">No. Rekening: <code className="rounded bg-muted px-2 py-0.5">{settings.account_no}</code>
                  <button onClick={() => copy(settings.account_no ?? "")} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              )}
              {settings.account_name && <div>Atas Nama: <b>{settings.account_name}</b></div>}
            </div>
          )}
          {settings.qris_image_url && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1">Atau scan QRIS:</div>
              <img src={settings.qris_image_url} alt="QRIS" className="h-48 w-48 rounded border border-border object-contain bg-white" />
            </div>
          )}
          {settings.instructions && <div className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{settings.instructions}</div>}
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted-foreground">RIWAYAT TAGIHAN</h2>
      <div className="space-y-3">
        {invoices.length === 0 && <div className="text-sm text-muted-foreground">Belum ada tagihan.</div>}
        {invoices.map((inv) => (
          <Card key={inv.id} className="p-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="font-mono text-sm font-semibold">{inv.invoice_no}</div>
                <div className="text-xs text-muted-foreground">{inv.plans?.name} · {new Date(inv.created_at).toLocaleString("id-ID")}</div>
                {inv.notes && <div className="mt-1 text-xs text-amber-700">{inv.notes}</div>}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">{formatIDR(inv.amount_idr)}</div>
                <StatusBadge status={inv.status} />
              </div>
            </div>
            {(inv.status === "pending" || inv.status === "awaiting_review") && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadProof(inv, e.target.files[0])} />
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent">
                    {busy === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {inv.payment_proof_url ? "Ganti bukti" : "Upload bukti"}
                  </span>
                </label>
                {inv.payment_proof_url && (
                  <button onClick={() => onViewProof(inv)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent">
                    <Eye className="h-3.5 w-3.5" /> Lihat bukti
                  </button>
                )}
                {inv.status === "pending" && !inv.payment_proof_url && (
                  <button onClick={() => onCancel(inv)} className="text-xs text-red-600 hover:underline ml-auto">Batalkan</button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    pending: { label: "Menunggu pembayaran", cls: "bg-muted text-muted-foreground", icon: Clock },
    awaiting_review: { label: "Menunggu review", cls: "bg-amber-500/15 text-amber-700", icon: Clock },
    paid: { label: "Lunas", cls: "bg-green-500/15 text-green-700", icon: CheckCircle2 },
    rejected: { label: "Ditolak", cls: "bg-red-500/15 text-red-700", icon: XCircle },
    cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground", icon: XCircle },
    expired: { label: "Kadaluarsa", cls: "bg-muted text-muted-foreground", icon: XCircle },
  };
  const it = map[status] ?? map.pending;
  const Icon = it.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${it.cls}`}><Icon className="h-3 w-3" /> {it.label}</span>;
}
