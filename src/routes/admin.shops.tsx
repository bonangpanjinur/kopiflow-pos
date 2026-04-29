import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/shops")({
  component: AdminShops,
});

type Shop = { id: string; name: string; slug: string; plan: string; plan_expires_at: string | null; custom_domain: string | null; custom_domain_verified_at: string | null; created_at: string };

function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase.from("coffee_shops").select("id, name, slug, plan, plan_expires_at, custom_domain, custom_domain_verified_at, created_at").order("created_at", { ascending: false })
      .then(({ data }) => setShops((data as Shop[]) ?? []));
  }, []);
  const filtered = shops.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.slug.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-4">Daftar Toko</h1>
      <Input placeholder="Cari nama atau slug…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      <div className="space-y-2">
        {filtered.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">/s/{s.slug}{s.custom_domain && ` · ${s.custom_domain}`}{s.custom_domain && s.custom_domain_verified_at && " ✓"}</div>
              </div>
              <div className="text-right">
                <Badge variant={s.plan === "pro" ? "default" : "secondary"}>{s.plan.toUpperCase()}</Badge>
                {s.plan_expires_at && <div className="mt-1 text-xs text-muted-foreground">s/d {new Date(s.plan_expires_at).toLocaleDateString("id-ID")}</div>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
