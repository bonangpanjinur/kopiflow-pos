import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/audit")({ component: AdminAudit });

type AuditEntry = {
  id: string;
  source: string;
  event_type: string;
  actor_id: string | null;
  shop_id: string | null;
  shop_name?: string;
  payload: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

const PAGE_SIZE = 25;

function AdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const results: AuditEntry[] = [];

    if (source === "all" || source === "system") {
      const q = supabase.from("system_audit").select("id, event_type, actor_id, shop_id, payload, notes, created_at").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      const { data } = await q;
      (data ?? []).forEach((d) => results.push({ ...d, source: "system", payload: d.payload as Record<string, unknown> | null } as AuditEntry));
    }

    if (source === "all" || source === "branding") {
      const { data } = await supabase.from("branding_audit").select("id, field, old_value, new_value, changed_by, shop_id, created_at").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      (data ?? []).forEach((d) => results.push({
        id: d.id, source: "branding", event_type: `branding.${d.field}`, actor_id: d.changed_by, shop_id: d.shop_id,
        payload: { old: d.old_value, new: d.new_value }, notes: null, created_at: d.created_at,
      }));
    }

    if (source === "all" || source === "domain") {
      const { data } = await supabase.from("domain_audit").select("id, action, old_domain, new_domain, actor_id, shop_id, notes, created_at").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      (data ?? []).forEach((d) => results.push({
        id: d.id, source: "domain", event_type: `domain.${d.action}`, actor_id: d.actor_id, shop_id: d.shop_id,
        payload: { old: d.old_domain, new: d.new_domain }, notes: d.notes, created_at: d.created_at,
      }));
    }

    if (source === "all" || source === "cron") {
      const { data } = await supabase.from("cron_runs").select("id, job_name, status, started_at, duration_ms, error_message").order("started_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      (data ?? []).forEach((d) => results.push({
        id: d.id, source: "cron", event_type: `cron.${d.job_name}`, actor_id: null, shop_id: null,
        payload: { status: d.status, duration_ms: d.duration_ms, error: d.error_message }, notes: null, created_at: d.started_at,
      }));
    }

    // Sort by date desc
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply search filter
    const filtered = search
      ? results.filter((r) => r.event_type.toLowerCase().includes(search.toLowerCase()) || (r.notes ?? "").toLowerCase().includes(search.toLowerCase()))
      : results;

    setHasMore(filtered.length > PAGE_SIZE);
    setEntries(filtered.slice(0, PAGE_SIZE));
    setLoading(false);
  }, [source, search, page]);

  useEffect(() => { load(); }, [load]);

  const sourceColor = (s: string) => {
    switch (s) {
      case "system": return "default";
      case "branding": return "secondary";
      case "domain": return "outline";
      case "cron": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="flex items-center gap-2 mb-6">
        <ScrollText className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Audit Log Terpadu</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={source} onValueChange={(v) => { setSource(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Sumber</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="branding">Branding</SelectItem>
            <SelectItem value="domain">Domain</SelectItem>
            <SelectItem value="cron">Cron</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari event..." className="pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground py-8 text-center">Memuat...</p>}
        {!loading && entries.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada log ditemukan.</p>}
        {entries.map((e) => (
          <Card key={`${e.source}-${e.id}`} className="p-3">
            <div className="flex items-start gap-3">
              <Badge variant={sourceColor(e.source) as "default" | "secondary" | "outline" | "destructive"} className="shrink-0 text-xs mt-0.5">{e.source}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono">{e.event_type}</p>
                {e.notes && <p className="text-xs text-muted-foreground mt-0.5">{e.notes}</p>}
                {e.payload && Object.keys(e.payload).length > 0 && (
                  <pre className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-1.5 overflow-x-auto max-h-20">{JSON.stringify(e.payload, null, 2)}</pre>
                )}
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {e.actor_id && <span>Actor: {e.actor_id.slice(0, 8)}…</span>}
                  {e.shop_id && <span>Shop: {e.shop_id.slice(0, 8)}…</span>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString("id-ID")}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 mt-4">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">Halaman {page + 1}</span>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
