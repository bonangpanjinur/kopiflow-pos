import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coffee, ShoppingBag, User as UserIcon } from "lucide-react";
import { readCart, cartCount } from "@/lib/customer-cart";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/s/$slug")({
  component: ShopLayout,
});

function ShopLayout() {
  const { slug } = useParams({ from: "/s/$slug" });
  const [shop, setShop] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [count, setCount] = useState(0);
  const { user, signOut } = useAuth();

  useEffect(() => {
    supabase
      .from("coffee_shops")
      .select("id,name,description")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => setShop(data));
  }, [slug]);

  useEffect(() => {
    const update = () => setCount(cartCount(readCart(slug)));
    update();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.slug === slug) update();
    };
    window.addEventListener("kopihub-cart-change", handler);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("kopihub-cart-change", handler);
      window.removeEventListener("storage", update);
    };
  }, [slug]);

  if (!shop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Memuat etalase…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
          <Link to="/s/$slug" params={{ slug }} className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Coffee className="h-4 w-4" />
            </div>
            <span className="truncate text-sm font-semibold">{shop.name}</span>
          </Link>
          <div className="flex items-center gap-1">
            {user ? (
              <Link to="/s/$slug/orders" params={{ slug }}>
                <Button variant="ghost" size="sm" className="gap-1">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Pesanan</span>
                </Button>
              </Link>
            ) : (
              <Link to="/s/$slug/login" params={{ slug }} search={{ redirect: "" }}>
                <Button variant="ghost" size="sm">Masuk</Button>
              </Link>
            )}
            <Link to="/s/$slug/cart" params={{ slug }}>
              <Button size="sm" className="relative gap-1">
                <ShoppingBag className="h-4 w-4" />
                <span>{count}</span>
              </Button>
            </Link>
            {user && (
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Keluar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
