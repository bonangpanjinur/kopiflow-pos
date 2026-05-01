import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIsSuperAdmin } from "@/lib/use-plan";
import { Loader2, ShieldCheck, LayoutDashboard, Store, FileText, Package, Globe, Settings, ArrowLeft, Activity, Blocks, Megaphone, ScrollText, Menu as MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/shops", label: "Toko", icon: Store },
  { to: "/admin/invoices", label: "Tagihan", icon: FileText },
  { to: "/admin/plans", label: "Paket", icon: Package },
  { to: "/admin/catalog", label: "Katalog", icon: Blocks },
  { to: "/admin/broadcast", label: "Broadcast", icon: Megaphone },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/admin/domains", label: "Domain", icon: Globe },
  { to: "/admin/activity", label: "Aktivitas", icon: Activity },
  { to: "/admin/settings", label: "Pengaturan", icon: Settings },
] as const;

function AdminLayout() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsSuperAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    if (!isAdmin) { navigate({ to: "/app" }); return; }
    setReady(true);
  }, [user, loading, isAdmin, roleLoading, navigate]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const SidebarBody = (
    <>
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <ShieldCheck className="h-5 w-5 text-amber-500" />
        <span className="text-sm font-semibold">Super Admin</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active = (item as { exact?: boolean }).exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
              <Icon className="h-4 w-4" />{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <Link to="/app" className="flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke App
        </Link>
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
          <ShieldCheck className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Super Admin</span>
        </header>

        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}
