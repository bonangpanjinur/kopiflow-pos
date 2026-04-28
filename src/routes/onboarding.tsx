import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Coffee, Loader2, Store } from "lucide-react";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [outletName, setOutletName] = useState("Outlet Pusat");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // If owner already has a shop → /app
    (async () => {
      const { data } = await supabase
        .from("coffee_shops")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        navigate({ to: "/app" });
      } else {
        setChecking(false);
      }
    })();
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const baseSlug = slugify(shopName) || `shop-${user.id.slice(0, 6)}`;
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: shop, error: shopErr } = await supabase
      .from("coffee_shops")
      .insert({
        owner_id: user.id,
        name: shopName,
        slug,
        description: description || null,
      })
      .select("id")
      .single();
    if (shopErr || !shop) {
      setBusy(false);
      toast.error(shopErr?.message ?? "Gagal membuat toko");
      return;
    }

    const { data: outlet, error: outletErr } = await supabase
      .from("outlets")
      .insert({
        shop_id: shop.id,
        name: outletName,
        address: address || null,
        phone: phone || null,
      })
      .select("id")
      .single();
    if (outletErr || !outlet) {
      setBusy(false);
      toast.error(outletErr?.message ?? "Gagal membuat outlet");
      return;
    }

    await supabase.from("user_roles").insert({
      user_id: user.id,
      role: "owner",
      shop_id: shop.id,
    });

    await supabase.from("user_preferences").upsert({
      user_id: user.id,
      default_outlet_id: outlet.id,
    });

    setBusy(false);
    toast.success("Toko Anda siap! Selamat datang di KopiHub.");
    navigate({ to: "/app" });
  };

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="mb-8 inline-flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">KopiHub</span>
        </div>

        <div className="mb-8">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Daftarkan toko Anda</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Beberapa info dasar untuk mulai. Bisa diubah kapan saja.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-pos">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tentang toko
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="shop">Nama toko *</Label>
                <Input id="shop" required value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="mis. Kopi Senja" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="desc">Deskripsi singkat</Label>
                <Textarea id="desc" value={description} rows={2}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specialty coffee dengan vibe hangat" className="mt-1.5" />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Outlet pertama
            </h2>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="outlet">Nama outlet *</Label>
                <Input id="outlet" required value={outletName}
                  onChange={(e) => setOutletName(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="address">Alamat</Label>
                <Input id="address" value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Asia Afrika No.1, Bandung" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="phone">Telepon</Label>
                <Input id="phone" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812-3456-7890" className="mt-1.5" />
              </div>
            </div>
          </div>

          <Button type="submit" className="h-11 w-full" disabled={busy || !shopName || !outletName}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buat toko & masuk dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
