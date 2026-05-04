import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/attendance")({
  component: AttendancePage,
});

type Attendance = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  business_date: string;
  outlet_id: string;
  display_name?: string | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}
function fmtDuration(min: number | null) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}j ${m}m`;
}

function AttendancePage() {
  const { shop, outlet, loading: shopLoading } = useCurrentShop();
  const { user } = useAuth();
  const [list, setList] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Attendance | null>(null); // current user's open clock-in

  async function load() {
    if (!shop || !user) return;
    setLoading(true);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data, error } = await supabase
      .from("attendances")
      .select("id, user_id, clock_in, clock_out, duration_minutes, business_date, outlet_id")
      .eq("shop_id", shop.id)
      .gte("business_date", sevenDaysAgo.toISOString().slice(0, 10))
      .order("clock_in", { ascending: false });
    if (error) toast.error(error.message);
    const rows = (data ?? []) as Attendance[];
    // hydrate names
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      rows.forEach((r) => {
        r.display_name = byId.get(r.user_id) ?? null;
      });
    }
    setList(rows);
    setOpen(rows.find((r) => r.user_id === user.id && !r.clock_out) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (shop && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, user?.id]);

  async function clockIn() {
    if (!shop || !outlet || !user) return;
    setBusy(true);
    const { error } = await supabase.from("attendances").insert({
      shop_id: shop.id,
      outlet_id: outlet.id,
      user_id: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Clock-in tercatat");
      load();
    }
    setBusy(false);
  }

  async function clockOut() {
    if (!open) return;
    setBusy(true);
    const { error } = await supabase
      .from("attendances")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", open.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Clock-out tercatat");
      load();
    }
    setBusy(false);
  }

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Absensi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catat kehadiran dengan satu ketukan. Riwayat 7 hari terakhir.
        </p>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Status saat ini</div>
          <div className="mt-1 text-lg font-semibold">
            {open ? (
              <>
                Sedang bekerja sejak <span className="text-primary">{fmtTime(open.clock_in)}</span>
              </>
            ) : (
              "Belum clock-in hari ini"
            )}
          </div>
          {outlet && (
            <div className="mt-0.5 text-xs text-muted-foreground">Outlet: {outlet.name}</div>
          )}
        </div>
        {open ? (
          <Button size="lg" variant="destructive" onClick={clockOut} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            Clock-out
          </Button>
        ) : (
          <Button size="lg" onClick={clockIn} disabled={busy || !outlet}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            Clock-in
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <Clock className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">Belum ada catatan absensi minggu ini.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Tanggal</th>
                <th className="px-4 py-2.5 text-left">Pegawai</th>
                <th className="px-4 py-2.5 text-right">Masuk</th>
                <th className="px-4 py-2.5 text-right">Keluar</th>
                <th className="px-4 py-2.5 text-right">Durasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(a.business_date)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {a.display_name ?? "—"}
                    {a.user_id === user?.id && (
                      <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Anda
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtTime(a.clock_in)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {a.clock_out ? fmtTime(a.clock_out) : <span className="text-emerald-600">Aktif</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {fmtDuration(a.duration_minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
