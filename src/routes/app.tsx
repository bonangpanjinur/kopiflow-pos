import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Coffee,
  LayoutDashboard,
  ShoppingBag,
  ListOrdered,
  UtensilsCrossed,
  Tags,
  Package,
  ChefHat,
  Users,
  CalendarDays,
  Clock,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  Loader2,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/pos", label: "POS", icon: ShoppingBag },
  { to: "/app/orders", label: "Order", icon: ListOrdered },
  { to: "/app/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/app/categories", label: "Kategori", icon: Tags },
  { to: "/app/inventory", label: "Inventori", icon: Package },
  { to: "/app/recipes", label: "Resep", icon: ChefHat },
  { to: "/app/employees", label: "Pegawai", icon: Users },
  { to: "/app/schedule", label: "Jadwal", icon: CalendarDays },
  { to: "/app/attendance", label: "Absensi", icon: Clock },
  { to: "/app/couriers", label: "Kurir", icon: Truck },
  { to: "/app/reports", label: "Laporan", icon: BarChart3 },
  { to: "/app/settings", label: "Pengaturan", icon: Settings },
];

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shopName, setShopName] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("coffee_shops")
        .select("name")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!data) {
        navigate({ to: "/onboarding" });
        return;
      }
      setShopName(data.name);
      setChecking(false);
    })();
  }, [user, loading, navigate]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">KopiHub</span>
        </div>

        <div className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-2.5 py-2">
            <Store className="h-4 w-4 text-sidebar-accent-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-sidebar-foreground/60">Toko aktif</div>
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {shopName}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-1 text-xs text-sidebar-foreground/60 truncate">
            {user?.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
              toast.success("Anda keluar");
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
