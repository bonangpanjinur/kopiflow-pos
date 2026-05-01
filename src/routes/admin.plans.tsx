import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { Grid3X3 } from "lucide-react";

export const Route = createFileRoute("/admin/plans")({ component: AdminPlans });

type Plan = { id: string; code: string; name: string; price_idr: number; duration_days: number; features: Record<string, unknown>; is_active: boolean; sort_order: number };

function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const reload = async () => {
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    setPlans((data as Plan[]) ?? []);
  };
  useEffect(() => { reload(); }, []);

  const save = async (p: Plan) => {
    const { error } = await supabase.from("plans").update({
      name: p.name, price_idr: p.price_idr, duration_days: p.duration_days, is_active: p.is_active, sort_order: p.sort_order,
    }).eq("id", p.id);
    if (error) toast.error(error.message); else toast.success("Tersimpan");
    await reload();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-4">Paket Berlangganan</h1>
      <div className="space-y-4">
        {plans.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Kode</Label><Input value={p.code} disabled /></div>
              <div><Label>Nama</Label><Input value={p.name} onChange={(e) => setPlans((arr) => arr.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))} /></div>
              <div><Label>Harga (IDR)</Label><Input type="number" value={p.price_idr} onChange={(e) => setPlans((arr) => arr.map((x) => x.id === p.id ? { ...x, price_idr: Number(e.target.value) } : x))} />
                <div className="text-xs text-muted-foreground mt-1">{formatIDR(p.price_idr)}</div></div>
              <div><Label>Durasi (hari)</Label><Input type="number" value={p.duration_days} onChange={(e) => setPlans((arr) => arr.map((x) => x.id === p.id ? { ...x, duration_days: Number(e.target.value) } : x))} /></div>
              <div className="flex items-center gap-2"><Switch checked={p.is_active} onCheckedChange={(v) => setPlans((arr) => arr.map((x) => x.id === p.id ? { ...x, is_active: v } : x))} /><Label>Aktif</Label></div>
              <div><Label>Urutan</Label><Input type="number" value={p.sort_order} onChange={(e) => setPlans((arr) => arr.map((x) => x.id === p.id ? { ...x, sort_order: Number(e.target.value) } : x))} /></div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={() => save(p)}>Simpan</Button>
              <Link to="/admin/plans/$id/matrix" params={{ id: p.id }}>
                <Button variant="outline" size="sm"><Grid3X3 className="h-3.5 w-3.5 mr-1" />Matrix Fitur & Tema</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
