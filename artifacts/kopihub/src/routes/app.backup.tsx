import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Database, Download, Loader2, Trash2, RefreshCw, Calendar, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
// import { listShopBackups, getBackupSchedule, requestShopBackup, getBackupDownloadUrl, deleteBackup, upsertBackupSchedule } from "@/server/backup.functions";

export const Route = createFileRoute("/app/backup")({ component: BackupPage });

type Backup = {
  id: string;
  status: string;
  file_path: string | null;
  size_bytes: number | null;
  includes: string[];
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

function formatBytes(b: number | null) {
  if (!b) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function BackupPage() {
  const { user } = useAuth();
  const [shopId, setShopId] = useState<string | null>(null);
  const [items, setItems] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<{ frequency: string; retention_days: number; last_run_at: string | null; next_run_at: string } | null>(null);
  const [freq, setFreq] = useState<"off" | "daily" | "weekly" | "monthly">("off");
  const [retention, setRetention] = useState(30);

  const reload = async () => {
    try {
      const { listShopBackups, getBackupSchedule } = await import("@/server/backup.functions");
      const list = await listShopBackups();
      setItems(Array.isArray(list) ? (list as unknown as Backup[]) : []);
      const sched = await getBackupSchedule();
      if (sched) {
        const s = sched as unknown as { frequency: string; retention_days: number; last_run_at: string | null; next_run_at: string };
        setSchedule(s);
        setFreq(s.frequency as typeof freq);
        setRetention(s.retention_days);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("coffee_shops").select("id").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => setShopId(data?.id ?? null));
    reload();
  }, [user]);

  const runBackup = async () => {
    if (!shopId) return;
    setBusy(true);
    try {
      const { requestShopBackup } = await import("@/server/backup.functions");
      const res = await requestShopBackup({ data: { shopId } });
      void res;
      toast.success("Backup berhasil diminta. Proses berjalan di background.");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = async (id: string) => {
    try {
      const { getBackupDownloadUrl } = await import("@/server/backup.functions");
      const { url } = await getBackupDownloadUrl({ data: { backupId: id } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus backup ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      const { deleteBackup } = await import("@/server/backup.functions");
      await deleteBackup({ data: { backupId: id } });
      toast.success("Backup dihapus");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveSchedule = async () => {
    try {
      const { upsertBackupSchedule } = await import("@/server/backup.functions");
      await upsertBackupSchedule({ data: { frequency: freq, retentionDays: retention } });
      toast.success("Jadwal backup tersimpan");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-5 flex items-center gap-2">
        <Database className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Backup &amp; Pemulihan</h1>
      </div>

      <Card className="p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Backup penuh sekarang
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Mengumpulkan seluruh data toko (menu, inventori, order, pelanggan, loyalty, dll) ke dalam satu file JSON.
            </p>
            <p className="text-xs text-muted-foreground mt-1">Maks 1 backup per 24 jam.</p>
          </div>
          <Button onClick={runBackup} disabled={busy || !shopId}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
            Backup sekarang
          </Button>
        </div>
      </Card>

      <Card className="p-5 mb-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4" /> Jadwal otomatis
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Frekuensi</Label>
            <Select value={freq} onValueChange={(v) => setFreq(v as typeof freq)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Mati</SelectItem>
                <SelectItem value="daily">Harian</SelectItem>
                <SelectItem value="weekly">Mingguan</SelectItem>
                <SelectItem value="monthly">Bulanan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Simpan selama (hari)</Label>
            <Input type="number" min={7} max={365} value={retention} onChange={(e) => setRetention(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <Button onClick={saveSchedule} variant="outline" className="w-full">Simpan jadwal</Button>
          </div>
        </div>
        {schedule && (
          <p className="text-xs text-muted-foreground mt-3">
            Backup berikutnya: {new Date(schedule.next_run_at).toLocaleString("id-ID")}
            {schedule.last_run_at && <> · terakhir: {new Date(schedule.last_run_at).toLocaleString("id-ID")}</>}
          </p>
        )}
      </Card>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Riwayat backup</h2>
        <Button variant="ghost" size="sm" onClick={reload}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Muat ulang
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Belum ada backup. Buat backup pertama Anda.</Card>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <Card key={b.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {new Date(b.created_at).toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.status} · {formatBytes(b.size_bytes)} · {Array.isArray(b.includes) ? b.includes.length : 0} tabel
                </div>
                {b.error_message && <div className="text-xs text-red-600">{b.error_message}</div>}
              </div>
              <div className="flex gap-2">
                {b.status === "completed" && (
                  <Button size="sm" variant="outline" onClick={() => download(b.id)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Unduh
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
