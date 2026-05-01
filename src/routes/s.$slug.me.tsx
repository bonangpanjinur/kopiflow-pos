import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Heart, ShoppingBag, Award, MapPin, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/s/$slug/me")({
  component: CustomerProfilePage,
});

function CustomerProfilePage() {
  const { slug } = useParams({ from: "/s/$slug/me" });
  const { user, loading: authLoading } = useAuth();
  const [shop, setShop] = useState<{ id: string; name: string } | null>(null);
  const [profile, setProfile] = useState<{ display_name: string | null; phone: string | null; email: string | null } | null>(null);
  const [orders, setOrders] = useState<{ id: string; order_no: string; total: number; status: string; created_at: string }[]>([]);
  const [favorites, setFavorites] = useState<{ id: string; menu_item_id: string; name: string }[]>([]);
  const [loyalty, setLoyalty] = useState<{ balance: number; total_earned: number; total_redeemed: number } | null>(null);
  const [addresses, setAddresses] = useState<{ id: string; label: string; address_line: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    (async () => {
      // Get shop
      const { data: s } = await supabase
        .from("coffee_shops")
        .select("id, name")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!s) { setLoading(false); return; }
      setShop(s);

      // Profile
      const { data: p } = await supabase
        .from("customer_profiles")
        .select("display_name, phone, email")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(p);

      // Orders (last 20)
      const { data: o } = await supabase
        .from("orders")
        .select("id, order_no, total, status, created_at")
        .eq("shop_id", s.id)
        .eq("customer_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setOrders(o ?? []);

      // Favorites
      const { data: f } = await supabase
        .from("customer_favorites")
        .select("id, menu_item_id")
        .eq("shop_id", s.id)
        .eq("user_id", user.id);
      if (f && f.length > 0) {
        const menuIds = f.map((x) => x.menu_item_id);
        const { data: items } = await supabase
          .from("menu_items")
          .select("id, name")
          .in("id", menuIds);
        const itemMap = new Map((items ?? []).map((i) => [i.id, i.name]));
        setFavorites(f.map((x) => ({ ...x, name: itemMap.get(x.menu_item_id) ?? "Menu" })));
      }

      // Loyalty
      const { data: l } = await supabase
        .from("loyalty_points")
        .select("balance, total_earned, total_redeemed")
        .eq("shop_id", s.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setLoyalty(l);

      // Addresses
      const { data: a } = await supabase
        .from("customer_addresses")
        .select("id, label, address_line")
        .eq("user_id", user.id)
        .limit(10);
      setAddresses(a ?? []);

      setLoading(false);
    })();
  }, [user, authLoading, slug]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-muted-foreground">Silakan login untuk melihat profil Anda.</p>
        <Link to="/s/$slug/login" params={{ slug }}>
          <Button>Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/s/$slug" params={{ slug }}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold">Profil Saya</h1>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="font-semibold text-lg">{profile?.display_name || user.email}</p>
          {profile?.phone && <p className="text-sm text-muted-foreground">📱 {profile.phone}</p>}
          {profile?.email && <p className="text-sm text-muted-foreground">✉️ {profile.email}</p>}
        </CardContent>
      </Card>

      {/* Loyalty */}
      {loyalty && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4" /> Poin Loyalty
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{loyalty.balance}</p>
                <p className="text-xs text-muted-foreground">Saldo</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{loyalty.total_earned}</p>
                <p className="text-xs text-muted-foreground">Diperoleh</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{loyalty.total_redeemed}</p>
                <p className="text-xs text-muted-foreground">Ditukar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4" /> Menu Favorit
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <Badge key={f.id} variant="secondary">{f.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Addresses */}
      {addresses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Alamat Tersimpan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {addresses.map((a) => (
              <div key={a.id} className="text-sm">
                <span className="font-medium">{a.label}:</span> {a.address_line}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" /> Riwayat Pesanan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div>
                    <span className="font-medium">#{o.order_no}</span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(o.created_at).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={o.status === "completed" || o.status === "delivered" ? "default" : "secondary"}>
                      {o.status}
                    </Badge>
                    <span className="font-medium">{formatIDR(o.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
