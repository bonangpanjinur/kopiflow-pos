import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { listCronRuns, listSystemAudit } from "@/server/observability.functions.server";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/activity")({ component: AdminActivity });

type CronRun = {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  duration_ms: number | null;
  result: Record<string, unknown>;
  error_message: string | null;
};

type AuditRow = {
  id: string;
  created_at: string;
  event_type: string;
  shop_id: string | null;
  actor_id: string | null;
  payload: Record<string, unknown>;
  notes: string | null;
};

const EVENT_LABEL: Record<string, string> = {
  plan_downgrade: "Plan turun ke Free",
  invoice_expire: "Invoice expired",
  domain_auto_unverify: "Domain auto-unverify",
  plan_approve: "Invoice disetujui",
  plan_reject: "Invoice ditolak",
  domain_force_verify: "Domain dipaksa verify",
};

function formatDuration(ms: number | null) {
  if (!ms) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function AdminActivity() {
  const [runs, setRuns] = useState<CronRun[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([
        listCronRuns({ data: { limit: 30 } }),
        listSystemAudit({
          data: { limit: 100, eventType: eventFilter === "all" ? undefined : eventFilter },
        }),
      ]);
      setRuns(r as CronRun[]);
      setAudit(a as AuditRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [eventFilter]);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Aktivitas Sistem</h1>
          <p className="text-sm text-muted-foreground">Riwayat cron & event audit untuk debugging.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Muat ulang</span>
        </Button>
      </div>

      <Tabs defaultValue="cron">
        <TabsList>
          <TabsTrigger value="cron">Cron Runs</TabsTrigger>
          <TabsTrigger value="audit">System Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="cron" className="mt-4">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Mulai</th>
                  <th className="px-3 py-2">Durasi</th>
                  <th className="px-3 py-2">Hasil</th>
                </tr>
              </thead>
              <tbody>
                {(runs ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      {r.status === "success" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" /> success
                        </span>
                      ) : r.status === "error" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          <AlertCircle className="h-3 w-3" /> error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          <Activity className="h-3 w-3" /> {r.status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.job_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(r.started_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-xs">{formatDuration(r.duration_ms)}</td>
                    <td className="px-3 py-2">
                      {r.error_message ? (
                        <span className="text-xs text-red-700">{r.error_message}</span>
                      ) : (
                        <pre className="max-w-md whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                          {JSON.stringify(r.result, null, 0)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
                {runs && runs.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada eksekusi cron.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter event:</span>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="plan_downgrade">Plan downgrade</SelectItem>
                <SelectItem value="invoice_expire">Invoice expire</SelectItem>
                <SelectItem value="domain_auto_unverify">Domain auto-unverify</SelectItem>
                <SelectItem value="plan_approve">Invoice approve</SelectItem>
                <SelectItem value="plan_reject">Invoice reject</SelectItem>
                <SelectItem value="domain_force_verify">Domain force verify</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Waktu</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Shop ID</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {(audit ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium">{EVENT_LABEL[row.event_type] ?? row.event_type}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {row.shop_id?.slice(0, 8) ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {row.notes && <div className="text-xs">{row.notes}</div>}
                      {Object.keys(row.payload || {}).length > 0 && (
                        <pre className="mt-0.5 max-w-md whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                          {JSON.stringify(row.payload)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
                {audit && audit.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada event.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
