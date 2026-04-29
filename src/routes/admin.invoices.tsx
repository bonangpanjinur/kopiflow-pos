import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { approveInvoice, rejectInvoice } from "@/server/billing.functions";

export const Route = createFileRoute("/admin/invoices")({
  component: AdminInvoices,
});

type Invoice = {
  id: string; invoice_no: string; amount_idr: number; status: string; payment_proof_url: string | null;
  created_at: string; notes: string | null;
  coffee_shops: { name: string; slug: string } | null;
  plans: { name: string } | null;
};

function AdminInvoices() {
  const [invs, setInvs] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("awaiting_review");

  const reload = async () => {
    let q = supabase.from("plan_invoices").select("id, invoice_no, amount_idr, status, payment_proof_url, created_at, notes, coffee_shops(name, slug), plans(name)").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setInvs((data as unknown as Invoice[]) ?? []);
  };
  useEffect(() => { reload(); }, [filter]);

  const onApprove = async (id: string) => {
    setBusy(id);
    try { await approveInvoice({ data: { invoiceId: id } }); toast.success("Tagihan disetujui & paket diaktifkan"); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const onReject = async (id: string) => {
    const reason = prompt("Alasan penolakan?") ?? undefined;
    setBusy(id);
    try { await rejectInvoice({ data: { invoiceId: id, reason } }); toast.success("Tagihan ditolak"); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-4">Tagihan</h1>
      <div className="mb-4 flex gap-2 flex-wrap">
        {["awaiting_review", "pending", "paid", "rejected", "all"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{s}</button>
        ))}
      </div>
      <div className="space-y-3">
        {invs.length === 0 && <div className="text-sm text-muted-foreground">Tidak ada tagihan.</div>}
        {invs.map((inv) => (
          <Card key={inv.id} className="p-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="font-mono text-sm font-semibold">{inv.invoice_no}</div>
                <div className="text-xs text-muted-foreground">{inv.coffee_shops?.name} · {inv.plans?.name} · {new Date(inv.created_at).toLocaleString("id-ID")}</div>
                {inv.notes && <div className="mt-1 text-xs text-amber-700">{inv.notes}</div>}
                {inv.payment_proof_url && <a href={inv.payment_proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">Lihat bukti pembayaran</a>}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">{formatIDR(inv.amount_idr)}</div>
                <Badge variant="secondary">{inv.status}</Badge>
              </div>
            </div>
            {inv.status === "awaiting_review" && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => onApprove(inv.id)} disabled={busy === inv.id}>
                  {busy === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Setujui"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReject(inv.id)} disabled={busy === inv.id}>Tolak</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
