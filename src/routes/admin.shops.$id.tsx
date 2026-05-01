import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, ShieldCheck, KeyRound, Crown, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/shops/$id")({
  component: AdminShopDetail,
});

type Detail = {
  shop: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    plan_expires_at: string | null;
    custom_domain: string | null;
    custom_domain_verified_at: string | null;
    suspended_at: string | null;
    suspended_reason: string | null;
    created_at: string;
  };
  owner: { id: string; display_name: string | null; phone: string | null };
  ownerEmail: string | null;
  ownerLastSignIn: string | null;
  outlets_count: number;
  orders_count: number;
  orders_30d: number;
  menu_count: number;
  last_order_at: string | null;
};

function AdminShopDetail() {
  const { id } = useParams({ from: "/admin/shops/$id" });
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [planMode, setPlanMode] = useState<"free" | "pro">("free");
  const [planExpires, setPlanExpires] = useState<string>("");
  const [suspendReason, setSuspendReason] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const { getShopDetail } = await import("@/server/admin-shops.functions");
      const res = (await getShopDetail({ data: { shopId: id } })) as Detail;
      setD(res);
      setPlanMode(res.shop.plan === "pro" ? "pro" : "free");
      setPlanExpires(res.shop.plan_expires_at ? res.shop.plan_expires_at.slice(0, 10) : "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const applyPlan = async () => {
    setBusy(true);
    try {
      const { setShopPlanManual } = await import("@/server/admin-shops.functions");
      const expiresIso =
        planMode === "pro" && planExpires
          ? new Date(planExpires + "T23:59:59").toISOString()
          : null;
      await setShopPlanManual({ data: { shopId: id, plan: planMode, expiresAt: expiresIso } });
      toast.success("Paket diperbarui");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doSuspend = async () => {
    if (suspendReason.trim().length < 3) {
      toast.error("Alasan minimal 3 karakter");
      return;
    }
    setBusy(true);
    try {
      const { suspendShop } = await import("@/server/admin-shops.functions");
      await suspendShop({ data: { shopId: id, reason: suspendReason.trim() } });
      toast.success("Toko dinonaktifkan");
      setSuspendReason("");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doUnsuspend = async () => {
    setBusy(true);
    try {
      const { unsuspendShop } = await import("@/server/admin-shops.functions");
      await unsuspendShop({ data: { shopId: id } });
      toast.success("Toko diaktifkan kembali");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setBusy(true);
    try {
      const { sendOwnerPasswordReset } = await import("@/server/admin-shops.functions");
      const res = (await sendOwnerPasswordReset({ data: { shopId: id } })) as { email: string };
      toast.success(`Link reset dikirim ke ${res.email}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !d) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = d.shop;
  const isSuspended = !!s.suspended_at;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
      <Link to="/admin/shops" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
          {s.name}
          {isSuspended && <Badge variant="destructive">Nonaktif</Badge>}
          {s.plan === "pro" && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Pro</Badge>}
        </h1>
        <div className="text-sm text-muted-foreground">
          /s/{s.slug}
          {s.custom_domain && (
            <> · {s.custom_domain}{s.custom_domain_verified_at ? " ✓" : " ✗"}</>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">Dibuat {new Date(s.created_at).toLocaleDateString("id-ID")}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Owner</h2>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Nama</dt><dd>{d.owner.display_name ?? "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Email</dt><dd className="truncate">{d.ownerEmail ?? "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Telepon</dt><dd>{d.owner.phone ?? "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Login terakhir</dt><dd>{d.ownerLastSignIn ? new Date(d.ownerLastSignIn).toLocaleString("id-ID") : "—"}</dd></div>
          </dl>
          <Button variant="outline" size="sm" className="mt-3" onClick={doReset} disabled={busy || !d.ownerEmail}>
            <KeyRound className="h-3.5 w-3.5 mr-1" /> Kirim reset password
          </Button>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Statistik</h2>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Outlet</dt><dd className="tabular-nums">{d.outlets_count}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Menu</dt><dd className="tabular-nums">{d.menu_count}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Total order</dt><dd className="tabular-nums">{d.orders_count}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Order 30 hari</dt><dd className="tabular-nums">{d.orders_30d}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Order terakhir</dt><dd>{d.last_order_at ? new Date(d.last_order_at).toLocaleString("id-ID") : "—"}</dd></div>
          </dl>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> Kelola Paket Manual</h2>
        <p className="text-xs text-muted-foreground mt-1">Override langsung tanpa membuat tagihan. Gunakan untuk komplimen / koreksi.</p>
        <div className="mt-3 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Paket</Label>
            <div className="flex gap-1 mt-1">
              <Button type="button" size="sm" variant={planMode === "free" ? "default" : "outline"} onClick={() => setPlanMode("free")}>Free</Button>
              <Button type="button" size="sm" variant={planMode === "pro" ? "default" : "outline"} onClick={() => setPlanMode("pro")}>Pro</Button>
            </div>
          </div>
          {planMode === "pro" && (
            <div>
              <Label className="text-xs">Berlaku sampai</Label>
              <Input type="date" value={planExpires} onChange={(e) => setPlanExpires(e.target.value)} className="mt-1 w-44" />
            </div>
          )}
          <Button onClick={applyPlan} disabled={busy || (planMode === "pro" && !planExpires)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Terapkan"}
          </Button>
          {s.plan_expires_at && (
            <span className="text-xs text-muted-foreground">Saat ini: {s.plan} s/d {new Date(s.plan_expires_at).toLocaleDateString("id-ID")}</span>
          )}
        </div>
      </Card>

      <Card className={`p-5 ${isSuspended ? "border-red-500/40 bg-red-500/5" : ""}`}>
        <h2 className="font-semibold flex items-center gap-2">
          {isSuspended ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <ShieldCheck className="h-4 w-4 text-green-600" />}
          {isSuspended ? "Toko Dinonaktifkan" : "Nonaktifkan Toko"}
        </h2>
        {isSuspended ? (
          <>
            <p className="text-sm mt-2">
              <span className="text-muted-foreground">Sejak:</span> {new Date(s.suspended_at!).toLocaleString("id-ID")}<br />
              <span className="text-muted-foreground">Alasan:</span> {s.suspended_reason ?? "—"}
            </p>
            <Button variant="outline" className="mt-3" onClick={doUnsuspend} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Aktifkan kembali
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mt-1">Storefront publik & app owner langsung terkunci. Owner tetap bisa login untuk melihat halaman billing.</p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Textarea
                rows={2}
                placeholder="Alasan (akan dikirim ke owner sebagai notifikasi)…"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
              <Button variant="destructive" onClick={doSuspend} disabled={busy || suspendReason.trim().length < 3}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldAlert className="h-4 w-4 mr-1" />}
                Nonaktifkan
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
