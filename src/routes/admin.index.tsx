import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Store, Crown, FileText, Coins, ArrowRight } from "lucide-react";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({ shops: 0, pro: 0, pending: 0, mrr: 0 });

  useEffect(() => {
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const [{ count: shops }, { count: pro }, { count: pending }, { data: paidThisMonth }] = await Promise.all([
        supabase.from("coffee_shops").select("id", { count: "exact", head: true }),
        supabase.from("coffee_shops").select("id", { count: "exact", head: true }).eq("plan", "pro"),
        supabase.from("plan_invoices").select("id", { count: "exact", head: true }).eq("status", "awaiting_review"),
        supabase.from("plan_invoices").select("amount_idr").eq("status", "paid").gte("paid_at", monthStart.toISOString()),
      ]);
      const mrr = (paidThisMonth ?? []).reduce((s: number, r: { amount_idr: number }) => s + r.amount_idr, 0);
      setStats({ shops: shops ?? 0, pro: pro ?? 0, pending: pending ?? 0, mrr });
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-6">Super Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Store} label="Total Toko" value={String(stats.shops)} />
        <Kpi icon={Crown} label="Toko Pro Aktif" value={String(stats.pro)} />
        <Kpi icon={FileText} label="Tagihan Menunggu Review" value={String(stats.pending)} link="/admin/invoices" />
        <Kpi icon={Coins} label="Pendapatan Bulan Ini" value={formatIDR(stats.mrr)} />
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, link }: { icon: React.ElementType; label: string; value: string; link?: string }) {
  const inner = (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1.5 flex items-end justify-between"><span className="text-2xl font-bold tabular-nums">{value}</span>{link && <ArrowRight className="h-4 w-4 text-muted-foreground" />}</div>
    </Card>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}
