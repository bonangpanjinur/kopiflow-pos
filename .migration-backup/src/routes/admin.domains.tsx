import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/domains")({ component: AdminDomains });

type Row = { id: string; name: string; slug: string; custom_domain: string | null; custom_domain_verified_at: string | null };

function AdminDomains() {
  const [rows, setRows] = useState<Row[]>([]);
  const reload = async () => {
    const { data } = await supabase.from("coffee_shops").select("id, name, slug, custom_domain, custom_domain_verified_at").not("custom_domain", "is", null).order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  };
  useEffect(() => { reload(); }, []);

  const setVerified = async (shopId: string, v: boolean) => {
    const { error } = await supabase.rpc("set_custom_domain_verified", { _shop_id: shopId, _verified: v });
    if (error) toast.error(error.message); else { toast.success(v ? "Diverifikasi" : "Verifikasi dicabut"); await reload(); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-4">Custom Domains</h1>
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Belum ada toko yang menambahkan custom domain.</div>}
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold">{r.custom_domain}</div>
                <div className="text-xs text-muted-foreground">{r.name} · /s/{r.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                {r.custom_domain_verified_at ? <Badge>Verified</Badge> : <Badge variant="secondary">Unverified</Badge>}
                {r.custom_domain_verified_at
                  ? <Button size="sm" variant="outline" onClick={() => setVerified(r.id, false)}>Cabut Verifikasi</Button>
                  : <Button size="sm" onClick={() => setVerified(r.id, true)}>Force Verify</Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
