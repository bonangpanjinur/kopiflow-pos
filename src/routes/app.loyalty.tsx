import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Award } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/loyalty")({
  component: LoyaltyPage,
});

type Settings = {
  shop_id: string;
  is_active: boolean;
  rupiah_per_point: number;
  point_value: number;
  min_redeem_points: number;
  max_redeem_percent: number;
};

type Holder = {
  user_id: string;
  balance: number;
  total_earned: number;
  total_redeemed: number;
  display_name: string | null;
  phone: string | null;
};

function LoyaltyPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holders, setHolders] = useState<Holder[]>([]);

  useEffect(() => {
    if (shopLoading || !shop) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("shop_id", shop.id)
        .maybeSingle();
      setSettings(
        (data as Settings | null) ?? {
          shop_id: shop.id,
          is_active: false,
          rupiah_per_point: 10000,
          point_value: 1000,
          min_redeem_points: 10,
          max_redeem_percent: 50,
        },
      );

      const { data: pts } = await supabase
        .from("loyalty_points")
        .select("user_id,balance,total_earned,total_redeemed")
        .eq("shop_id", shop.id)
        .order("balance", { ascending: false })
        .limit(50);

      const ids = (pts ?? []).map((p) => p.user_id);
      let profiles: { user_id: string; display_name: string | null; phone: string | null }[] = [];
      if (ids.length > 0) {
        const { data: cp } = await supabase
          .from("customer_profiles")
          .select("user_id,display_name,phone")
          .in("user_id", ids);
        profiles = (cp ?? []) as typeof profiles;
      }
      setHolders(
        (pts ?? []).map((p) => {
          const cp = profiles.find((x) => x.user_id === p.user_id);
          return {
            ...(p as { user_id: string; balance: number; total_earned: number; total_redeemed: number }),
            display_name: cp?.display_name ?? null,
            phone: cp?.phone ?? null,
          };
        }),
      );
      setLoading(false);
    })();
  }, [shop, shopLoading]);

  async function save() {
    if (!shop || !settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("loyalty_settings")
      .upsert({ ...settings, shop_id: shop.id }, { onConflict: "shop_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pengaturan tersimpan");
  }

  if (loading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Loyalty Point</h1>
        <p className="text-sm text-muted-foreground">
          Customer dapat poin tiap belanja, redeem jadi diskon di order berikutnya.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <span className="font-medium">Aktifkan loyalty</span>
          </div>
          <Switch
            checked={settings.is_active}
            onCheckedChange={(v) => setSettings({ ...settings, is_active: v })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Tiap belanja Rp ... dapat 1 poin</Label>
            <Input
              type="number"
              value={settings.rupiah_per_point}
              onChange={(e) =>
                setSettings({ ...settings, rupiah_per_point: Number(e.target.value) || 0 })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mis. 10.000 → tiap Rp10.000 = 1 poin
            </p>
          </div>
          <div>
            <Label className="text-xs">Nilai 1 poin saat redeem (Rp)</Label>
            <Input
              type="number"
              value={settings.point_value}
              onChange={(e) =>
                setSettings({ ...settings, point_value: Number(e.target.value) || 0 })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mis. 1.000 → 10 poin = {formatIDR(10 * settings.point_value)}
            </p>
          </div>
          <div>
            <Label className="text-xs">Min. poin untuk redeem</Label>
            <Input
              type="number"
              value={settings.min_redeem_points}
              onChange={(e) =>
                setSettings({ ...settings, min_redeem_points: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Max % subtotal yg bisa dipotong poin</Label>
            <Input
              type="number"
              value={settings.max_redeem_percent}
              onChange={(e) =>
                setSettings({ ...settings, max_redeem_percent: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Pemegang poin teratas</h2>
        {holders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada customer dengan poin.</p>
        ) : (
          <div className="divide-y divide-border">
            {holders.map((h) => (
              <div key={h.user_id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.display_name ?? "Customer"}</p>
                  <p className="text-xs text-muted-foreground">{h.phone ?? "-"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{h.balance.toLocaleString("id-ID")} poin</p>
                  <p className="text-xs text-muted-foreground">
                    earn {h.total_earned} · redeem {h.total_redeemed}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
