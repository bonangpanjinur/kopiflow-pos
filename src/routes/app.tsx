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
  Bike,
  Wallet,
  Bell,
  Navigation,
  BarChart3,
  Settings,
  LogOut,
  Loader2,
  Store,
  TicketPercent,
  Award,
  Menu as MenuIcon,
  Building2,
  FileText,
  CreditCard,
  Globe,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { usePlan, useIsSuperAdmin } from "@/lib/use-plan";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { OwnerReminderBanner } from "@/components/owner-reminder-banner";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/pos", label: "POS", icon: ShoppingBag },
  { to: "/app/orders", label: "Order", icon: ListOrdered },
  { to: "/app/online-orders", label: "Order Online", icon: Bell },
  { to: "/app/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/app/categories", label: "Kategori", icon: Tags },
  { to: "/app/inventory", label: "Inventori", icon: Package },
  { to: "/app/suppliers", label: "Supplier", icon: Building2 },
  { to: "/app/purchase-orders", label: "Purchase Order", icon: FileText },
  { to: "/app/recipes", label: "Resep", icon: ChefHat },
  { to: "/app/employees", label: "Pegawai", icon: Users },
  { to: "/app/schedule", label: "Jadwal", icon: CalendarDays },
  { to: "/app/attendance", label: "Absensi", icon: Clock },
  { to: "/app/delivery", label: "Delivery", icon: Truck },
  { to: "/app/couriers", label: "Kurir", icon: Bike },
  { to: "/app/courier", label: "Pengantaran", icon: Navigation },
  { to: "/app/shifts", label: "Shift Kasir", icon: Wallet },
  { to: "/app/reports", label: "Laporan", icon: BarChart3 },
  { to: "/app/promos", label: "Promo", icon: TicketPercent },
  { to: "/app/loyalty", label: "Loyalty", icon: Award },
  { to: "/app/billing", label: "Plan & Tagihan", icon: CreditCard },
  { to: "/app/domain", label: "Domain Kustom", icon: Globe, proOnly: true },
  { to: "/app/settings", label: "Pengaturan", icon: Settings },
] as const;

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isPro } = usePlan();
  const { isAdmin } = useIsSuperAdmin();
  const [shop, setShop] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("coffee_shops")
        .select("name, logo_url, suspended_at, suspended_reason")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!data) {
        navigate({ to: "/onboarding" });
        return;
      }
      setShop(data);
      setChecking(false);
      if (data.suspended_at && location.pathname !== "/app/billing") {
        toast.error("Toko Anda dinonaktifkan oleh admin. Hubungi admin.");
        navigate({ to: "/app/billing" });
      }
    })();
  }, [user, loading, navigate, location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Request notification permission once
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Defer prompting until user interacts; just leave permission as-is
    }
  }, []);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SidebarBody = (
    <>
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
          {shop?.logo_url ? (
            <img src={shop.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Coffee className="h-4 w-4" />
          )}
        </div>
        <span className="text-sm font-semibold">KopiHub</span>
      </div>

      <div className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/50 px-2.5 py-2">
          <Store className="h-4 w-4 text-sidebar-accent-foreground shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-sidebar-foreground/60">Toko aktif</div>
            <div className="truncate text-sm font-medium text-sidebar-foreground">
              {shop?.name}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active = (item as { exact?: boolean }).exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          const locked = (item as { proOnly?: boolean }).proOnly && !isPro;
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
              <span className="flex-1">{item.label}</span>
              {(item as { proOnly?: boolean }).proOnly && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isPro ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {locked ? <Lock className="h-3 w-3 inline" /> : "PRO"}
                </span>
              )}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            to="/admin"
            className="mt-2 flex items-center gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/20"
          >
            <ShieldCheck className="h-4 w-4" /> Super Admin
          </Link>
        )}
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
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        {SidebarBody}
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MenuIcon className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar flex flex-col">
              {SidebarBody}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground overflow-hidden shrink-0">
              {shop?.logo_url ? (
                <img src={shop.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Coffee className="h-3.5 w-3.5" />
              )}
            </div>
            <span className="truncate text-sm font-semibold">{shop?.name ?? "KopiHub"}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <OwnerReminderBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
