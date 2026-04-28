import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/schedule")({
  component: SchedulePage,
});

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type Shift = {
  id: string;
  user_id: string;
  outlet_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  note: string | null;
};
type Member = {
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
};
type Outlet = { id: string; name: string };

function SchedulePage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [userId, setUserId] = useState("");
  const [outletId, setOutletId] = useState("");
  const [day, setDay] = useState("1");
  const [startT, setStartT] = useState("08:00");
  const [endT, setEndT] = useState("16:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const [s, r, o] = await Promise.all([
      supabase.from("shifts").select("*").eq("shop_id", shop.id).order("day_of_week"),
      supabase.from("user_roles").select("user_id, role").eq("shop_id", shop.id),
      supabase.from("outlets").select("id, name").eq("shop_id", shop.id),
    ]);
    const roles = (r.data ?? []) as { user_id: string; role: string }[];
    const ids = [...new Set(roles.map((x) => x.user_id))];
    let mems: Member[] = [];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      mems = roles.map((rr) => ({
        user_id: rr.user_id,
        role: rr.role,
        display_name: byId.get(rr.user_id)?.display_name ?? null,
        avatar_url: byId.get(rr.user_id)?.avatar_url ?? null,
      }));
    }
    setShifts((s.data ?? []) as Shift[]);
    setMembers(mems);
    setOutlets((o.data ?? []) as Outlet[]);
    if (!outletId && o.data && o.data.length > 0) setOutletId(o.data[0].id);
    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id]);

  function openNew(uid: string, dow: number) {
    setEditing(null);
    setUserId(uid);
    setDay(String(dow));
    setOutletId(outlets[0]?.id ?? "");
    setStartT("08:00");
    setEndT("16:00");
    setNote("");
    setOpen(true);
  }

  function openEdit(sh: Shift) {
    setEditing(sh);
    setUserId(sh.user_id);
    setOutletId(sh.outlet_id);
    setDay(String(sh.day_of_week));
    setStartT(sh.start_time.slice(0, 5));
    setEndT(sh.end_time.slice(0, 5));
    setNote(sh.note ?? "");
    setOpen(true);
  }

  async function save() {
    if (!shop || !userId || !outletId) return;
    setSaving(true);
    const payload = {
      shop_id: shop.id,
      user_id: userId,
      outlet_id: outletId,
      day_of_week: Number(day),
      start_time: startT,
      end_time: endT,
      note: note.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from("shifts").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Jadwal diperbarui");
    } else {
      const { error } = await supabase.from("shifts").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Jadwal ditambahkan");
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function remove(sh: Shift) {
    const { error } = await supabase.from("shifts").delete().eq("id", sh.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Dihapus");
      load();
    }
  }

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach((s) => {
      const k = `${s.user_id}-${s.day_of_week}`;
      map.set(k, [...(map.get(k) ?? []), s]);
    });
    return map;
  }, [shifts]);

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Jadwal kerja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur shift mingguan untuk setiap pegawai.
        </p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Belum ada pegawai</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Undang pegawai dulu di halaman Pegawai sebelum membuat jadwal.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">Pegawai</th>
                {DAYS.map((d) => (
                  <th key={d} className="px-2 py-2.5 text-center w-32">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          (m.display_name ?? "?").charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{m.display_name ?? "—"}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {m.role}
                        </div>
                      </div>
                    </div>
                  </td>
                  {DAYS.map((_, dow) => {
                    const cell = shiftsByCell.get(`${m.user_id}-${dow}`) ?? [];
                    return (
                      <td key={dow} className="px-1 py-2 align-top">
                        <div className="space-y-1">
                          {cell.map((sh) => (
                            <button
                              key={sh.id}
                              onClick={() => openEdit(sh)}
                              className="block w-full rounded-md bg-primary/10 px-2 py-1 text-left text-xs font-medium text-primary hover:bg-primary/20"
                            >
                              {sh.start_time.slice(0, 5)}–{sh.end_time.slice(0, 5)}
                            </button>
                          ))}
                          <button
                            onClick={() => openNew(m.user_id, dow)}
                            className="flex w-full items-center justify-center rounded-md border border-dashed border-border py-1 text-xs text-muted-foreground hover:bg-muted/50"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit shift" : "Tambah shift"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hari</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Outlet</Label>
                <Select value={outletId} onValueChange={setOutletId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mulai</Label>
                <Input type="time" value={startT} onChange={(e) => setStartT(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Selesai</Label>
                <Input type="time" value={endT} onChange={(e) => setEndT(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. Shift pagi" />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    remove(editing);
                    setOpen(false);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
