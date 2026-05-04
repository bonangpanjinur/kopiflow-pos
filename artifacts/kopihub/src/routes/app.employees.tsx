import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { useAuth } from "@/lib/auth";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Users, Copy, Check, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/employees")({
  component: EmployeesPage,
});

type RoleRow = {
  id: string;
  user_id: string;
  role: string;
  outlet_id: string | null;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};
type Outlet = { id: string; name: string };

const ROLES = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Kasir" },
  { value: "barista", label: "Barista" },
];

function roleLabel(r: string) {
  return ROLES.find((x) => x.value === r)?.label ?? r;
}

function EmployeesPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const { user } = useAuth();
  const [members, setMembers] = useState<RoleRow[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("cashier");
  const [outletId, setOutletId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const [r, i, o] = await Promise.all([
      supabase.from("user_roles").select("id, user_id, role, outlet_id").eq("shop_id", shop.id),
      supabase
        .from("staff_invitations")
        .select("id, email, role, token, expires_at, accepted_at, created_at")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false }),
      supabase.from("outlets").select("id, name").eq("shop_id", shop.id),
    ]);
    const rows = (r.data ?? []) as RoleRow[];
    // Hydrate profiles
    const userIds = [...new Set(rows.map((x) => x.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((row) => {
        row.profile = byId.get(row.user_id) ?? null;
      });
    }
    setMembers(rows);
    setInvitations((i.data ?? []) as Invitation[]);
    setOutlets((o.data ?? []) as Outlet[]);
    if (!outletId && o.data && o.data.length > 0) setOutletId(o.data[0].id);
    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id]);

  async function invite() {
    if (!shop || !user || !email.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("staff_invitations").insert({
      shop_id: shop.id,
      outlet_id: outletId || null,
      email: email.trim().toLowerCase(),
      role: role as "manager" | "cashier" | "barista",
      invited_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Undangan dibuat — bagikan tautannya");
      setEmail("");
      setOpen(false);
      load();
    }
    setSaving(false);
  }

  async function revokeInvitation(id: string) {
    if (!confirm("Batalkan undangan ini?")) return;
    const { error } = await supabase.from("staff_invitations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Dibatalkan");
      load();
    }
  }

  async function removeMember(m: RoleRow) {
    if (!confirm(`Keluarkan pegawai ini dari toko?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pegawai dikeluarkan");
      load();
    }
  }

  function inviteUrl(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(inviteUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = invitations.filter((i) => !i.accepted_at);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pegawai</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Undang tim, atur peran, dan kelola akses ke POS.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Undang pegawai
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Undang pegawai</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pegawai@toko.com"
                />
                <p className="text-xs text-muted-foreground">
                  Pegawai harus daftar dengan email yang sama untuk menerima undangan.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Peran</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Outlet</Label>
                  <Select value={outletId} onValueChange={setOutletId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih outlet" />
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
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={invite} disabled={saving || !email.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Buat undangan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              ANGGOTA AKTIF ({members.length})
            </h2>
            {members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                  <Users className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground">Belum ada pegawai. Mulai dengan mengundang.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Nama</th>
                      <th className="px-4 py-2.5 text-left">Peran</th>
                      <th className="px-4 py-2.5 text-left">Outlet</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {members.map((m) => {
                      const outlet = outlets.find((o) => o.id === m.outlet_id);
                      return (
                        <tr key={m.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase text-accent-foreground">
                                {m.profile?.avatar_url ? (
                                  <img src={m.profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                                ) : (
                                  (m.profile?.display_name ?? "?").charAt(0)
                                )}
                              </div>
                              <span className="font-medium">{m.profile?.display_name ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium">
                              {roleLabel(m.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {outlet?.name ?? "Semua"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMember(m)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                UNDANGAN BELUM DITERIMA ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{inv.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {roleLabel(inv.role)} · kadaluarsa{" "}
                          {new Date(inv.expires_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => copy(inv.token)}>
                        {copied === inv.token ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Salin tautan
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeInvitation(inv.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
