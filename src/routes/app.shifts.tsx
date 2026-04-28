import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  PlayCircle,
  StopCircle,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import {
  type CashShift,
  type CashMovement,
  getActiveShift,
  openShift,
  closeShift,
  addCashMovement,
} from "@/lib/shift";

export const Route = createFileRoute("/app/shifts")({
  component: ShiftsPage,
});

function ShiftsPage() {
  const { shop, outlet, loading: shopLoading } = useCurrentShop();
  const { user } = useAuth();
  const [active, setActive] = useState<CashShift | null>(null);
  const [history, setHistory] = useState<CashShift[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDlg, setOpenDlg] = useState(false);
  const [closeDlg, setCloseDlg] = useState(false);
  const [moveDlg, setMoveDlg] = useState<"in" | "out" | null>(null);

  async function load() {
    if (!outlet) return;
    setLoading(true);
    const a = await getActiveShift(outlet.id);
    setActive(a);
    const { data: hist } = await supabase
      .from("cash_shifts")
      .select("*")
      .eq("outlet_id", outlet.id)
      .order("opened_at", { ascending: false })
      .limit(20);
    setHistory((hist as CashShift[]) ?? []);
    if (a) {
      const { data: mvs } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("shift_id", a.id)
        .order("created_at", { ascending: false });
      setMovements((mvs as CashMovement[]) ?? []);
    } else {
      setMovements([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (outlet) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?.id]);

  if (shopLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!outlet || !shop || !user) return null;

  const cashIn = movements.filter((m) => m.type === "in").reduce((s, m) => s + Number(m.amount), 0);
  const cashOut = movements.filter((m) => m.type === "out").reduce((s, m) => s + Number(m.amount), 0);
  const refunds = movements.filter((m) => m.type === "refund").reduce((s, m) => s + Number(m.amount), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Kasir</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {shop.name} · {outlet.name}
          </p>
        </div>
        {active ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMoveDlg("in")}>
              <ArrowDownCircle className="mr-1.5 h-4 w-4" /> Kas masuk
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMoveDlg("out")}>
              <ArrowUpCircle className="mr-1.5 h-4 w-4" /> Kas keluar
            </Button>
            <Button size="sm" onClick={() => setCloseDlg(true)}>
              <StopCircle className="mr-1.5 h-4 w-4" /> Tutup shift
            </Button>
          </div>
        ) : (
          <Button onClick={() => setOpenDlg(true)}>
            <PlayCircle className="mr-1.5 h-4 w-4" /> Buka shift
          </Button>
        )}
      </div>

      {active ? (
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Shift berjalan</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              dibuka {new Date(active.opened_at).toLocaleString("id-ID")}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Modal awal" value={formatIDR(Number(active.opening_cash))} />
            <Stat label="Kas masuk" value={formatIDR(cashIn)} />
            <Stat label="Kas keluar" value={formatIDR(cashOut)} />
            <Stat label="Refund" value={formatIDR(refunds)} />
          </div>

          {movements.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-xs font-semibold uppercase text-muted-foreground">Aktivitas kas</h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {movements.slice(0, 10).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium capitalize">{moveLabel(m.type)}</div>
                      {m.note && <div className="truncate text-xs text-muted-foreground">{m.note}</div>}
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${m.type === "out" || m.type === "refund" ? "text-destructive" : ""}`}>
                        {m.type === "out" || m.type === "refund" ? "-" : "+"}{formatIDR(Number(m.amount))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center mb-6">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada shift aktif. Buka shift untuk memulai POS.</p>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Riwayat shift</h2>
      {history.length === 0 ? (
        <div className="text-sm text-muted-foreground">Belum ada riwayat.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Buka</th>
                <th className="px-4 py-2 text-left">Tutup</th>
                <th className="px-4 py-2 text-right">Modal</th>
                <th className="px-4 py-2 text-right">Expected</th>
                <th className="px-4 py-2 text-right">Aktual</th>
                <th className="px-4 py-2 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((s) => {
                const v = s.variance == null ? null : Number(s.variance);
                return (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">{new Date(s.opened_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {s.closed_at ? new Date(s.closed_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatIDR(Number(s.opening_cash))}</td>
                    <td className="px-4 py-2.5 text-right">{s.expected_cash != null ? formatIDR(Number(s.expected_cash)) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{s.closing_cash != null ? formatIDR(Number(s.closing_cash)) : "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${v == null ? "" : v < 0 ? "text-destructive" : v > 0 ? "text-amber-600" : ""}`}>
                      {v == null ? "—" : (v >= 0 ? "+" : "") + formatIDR(v)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openDlg && (
        <OpenShiftDialog
          outletId={outlet.id}
          onClose={() => setOpenDlg(false)}
          onDone={() => {
            setOpenDlg(false);
            load();
          }}
        />
      )}
      {closeDlg && active && (
        <CloseShiftDialog
          shift={active}
          onClose={() => setCloseDlg(false)}
          onDone={() => {
            setCloseDlg(false);
            load();
          }}
        />
      )}
      {moveDlg && active && (
        <CashMoveDialog
          shiftId={active.id}
          type={moveDlg}
          onClose={() => setMoveDlg(null)}
          onDone={() => {
            setMoveDlg(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function moveLabel(t: CashMovement["type"]) {
  switch (t) {
    case "opening": return "Modal awal";
    case "closing": return "Tutup shift";
    case "in": return "Kas masuk";
    case "out": return "Kas keluar";
    case "sale": return "Penjualan";
    case "refund": return "Refund";
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function OpenShiftDialog({ outletId, onClose, onDone }: { outletId: string; onClose: () => void; onDone: () => void }) {
  const [opening, setOpening] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Buka shift</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Modal kas awal</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0"
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">Uang fisik yang ada di laci kas saat ini.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await openShift(outletId, Number(opening || 0));
                toast.success("Shift dibuka");
                onDone();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Buka shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseShiftDialog({ shift, onClose, onDone }: { shift: CashShift; onClose: () => void; onDone: () => void }) {
  const [closing, setClosing] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ expected_cash: number; variance: number } | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Tutup shift</DialogTitle></DialogHeader>
        {!result ? (
          <>
            <div className="space-y-3 py-2">
              <div>
                <Label>Uang kas akhir (aktual)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={closing}
                  onChange={(e) => setClosing(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
                <p className="mt-1 text-xs text-muted-foreground">Hitung uang fisik di laci sekarang.</p>
              </div>
              <div>
                <Label>Catatan (opsional)</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Batal</Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const res = await closeShift(shift.id, Number(closing || 0), note || undefined);
                    setResult({ expected_cash: res.expected_cash, variance: res.variance });
                    toast.success("Shift ditutup");
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Tutup shift
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between"><span>Expected</span><span className="font-semibold">{formatIDR(result.expected_cash)}</span></div>
              <div className="flex justify-between"><span>Aktual</span><span className="font-semibold">{formatIDR(Number(closing || 0))}</span></div>
              <div className={`flex justify-between rounded-md p-2 ${result.variance < 0 ? "bg-destructive/10 text-destructive" : result.variance > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                <span className="font-medium">Selisih</span>
                <span className="font-bold">{(result.variance >= 0 ? "+" : "") + formatIDR(result.variance)}</span>
              </div>
            </div>
            <DialogFooter><Button onClick={onDone}>Selesai</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CashMoveDialog({ shiftId, type, onClose, onDone }: { shiftId: string; type: "in" | "out"; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{type === "in" ? "Kas masuk" : "Kas keluar"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Jumlah</Label>
            <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Keterangan</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "in" ? "Setoran tambahan" : "Beli galon, bayar parkir, dll"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button
            disabled={saving || !amount}
            onClick={async () => {
              setSaving(true);
              try {
                await addCashMovement(shiftId, type, Number(amount), note || undefined);
                toast.success("Tersimpan");
                onDone();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
