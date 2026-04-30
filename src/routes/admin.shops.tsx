import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/shops")({
  component: AdminShops,
});

type Shop = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_expires_at: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  created_at: string;
  suspended_at: string | null;
};

type StatusFilter = "all" | "pro_active" | "expiring" | "expired" | "free" | "domain_offline";

function getPlanStatus(s: Shop): { label: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (s.plan !== "pro") return { label: "Free", tone: "muted" };
  if (!s.plan_expires_at) return { label: "Pro", tone: "ok" };
  const days = Math.ceil((new Date(s.plan_expires_at).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Expired", tone: "bad" };
  if (days <= 7) return { label: `Expiring ${days}h`, tone: "warn" };
  return { label: "Pro Active", tone: "ok" };
}

function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    supabase.from("coffee_shops").select("id, name, slug, plan, plan_expires_at, custom_domain, custom_domain_verified_at, created_at, suspended_at").order("created_at", { ascending: false })
      .then(({ data }) => setShops((data as Shop[]) ?? []));
  }, []);

  const filtered = useMemo(() => {
    return shops.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.slug.toLowerCase().includes(q.toLowerCase())) return false;
      if (filter === "all") return true;
      const st = getPlanStatus(s);
      if (filter === "pro_active") return st.label === "Pro Active" || st.label === "Pro";
      if (filter === "expiring") return st.label.startsWith("Expiring");
      if (filter === "expired") return st.label === "Expired";
      if (filter === "free") return s.plan === "free";
      if (filter === "domain_offline") return !!s.custom_domain && !s.custom_domain_verified_at;
      return true;
    });
  }, [shops, q, filter]);

  const FILTERS: Array<{ key: StatusFilter; label: string }> = [
    { key: "all", label: "Semua" },
    { key: "pro_active", label: "Pro Aktif" },
    { key: "expiring", label: "Akan Habis" },
    { key: "expired", label: "Expired" },
    { key: "free", label: "Free" },
    { key: "domain_offline", label: "Domain Offline" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <h1 className="text-2xl font-bold mb-4">Daftar Toko</h1>
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <Input placeholder="Cari nama atau slug…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} toko</span>
      </div>
      <div className="space-y-2">
        {filtered.map((s) => {
          const st = getPlanStatus(s);
          const toneCls = st.tone === "ok" ? "bg-green-500/15 text-green-700"
            : st.tone === "warn" ? "bg-amber-500/15 text-amber-700"
            : st.tone === "bad" ? "bg-red-500/15 text-red-700"
            : "bg-muted text-muted-foreground";
          const domainOffline = s.custom_domain && !s.custom_domain_verified_at;
          return (
            <Link key={s.id} to="/admin/shops/$id" params={{ id: s.id }} className="block">
            <Card className="p-4 hover:bg-accent/40 transition-colors">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {s.name}
                    {s.suspended_at && <Badge variant="destructive" className="text-[10px]">Nonaktif</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    /s/{s.slug}
                    {s.custom_domain && (
                      <> · <span className={domainOffline ? "text-red-600" : ""}>{s.custom_domain}{s.custom_domain_verified_at ? " ✓" : " ✗"}</span></>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${toneCls}`}>{st.label}</span>
                  {s.plan_expires_at && <div className="text-xs text-muted-foreground">s/d {new Date(s.plan_expires_at).toLocaleDateString("id-ID")}</div>}
                  {domainOffline && <div><Badge variant="destructive" className="text-[10px]">Domain Offline</Badge></div>}
                </div>
              </div>
            </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
