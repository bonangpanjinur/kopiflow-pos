import { createFileRoute, Link, Outlet, useParams, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coffee, ShoppingBag, User as UserIcon } from "lucide-react";
import { readCart, cartCount } from "@/lib/customer-cart";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getShopForStorefront } from "@/server/tenant.functions";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const res = await getShopForStorefront({ data: { slug: params.slug } });
    if (!res.shop) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.shop) return {};
    const shop = loaderData.shop;
    const baseUrl = loaderData.baseUrl;
    const title = `${shop.name} — Pesan Online`;
    const description =
      shop.description ?? shop.tagline ?? `Pesan kopi & menu favorit langsung dari ${shop.name}.`;
    const image = shop.logo_url ?? undefined;

    const ld = {
      "@context": "https://schema.org",
      "@type": "CafeOrCoffeeShop",
      name: shop.name,
      description,
      image: image ? [image] : undefined,
      telephone: shop.phone ?? undefined,
      address: shop.address
        ? { "@type": "PostalAddress", streetAddress: shop.address }
        : undefined,
      url: baseUrl,
    };

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "theme-color", content: "#0f172a" },
        { property: "og:type", content: "restaurant.restaurant" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: baseUrl },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
        { name: "apple-mobile-web-app-title", content: shop.name },
      ],
      links: [
        { rel: "canonical", href: baseUrl },
        { rel: "manifest", href: `/api/public/manifest/${shop.slug}` },
        ...(image ? [{ rel: "icon", href: image }, { rel: "apple-touch-icon", href: image }] : []),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(ld),
        },
      ],
    };
  },
  component: ShopLayout,
  notFoundComponent: ShopNotFound,
});

function ShopNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-3xl font-bold">Toko tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Etalase yang Anda cari tidak tersedia atau sudah dinonaktifkan oleh pemilik.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}

function ShopLayout() {
  const { slug } = useParams({ from: "/s/$slug" });
  const { shop } = Route.useLoaderData();
  const [count, setCount] = useState(0);
  const { user, signOut } = useAuth();

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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground overflow-hidden">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Coffee className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">{shop.name}</div>
              {shop.tagline && (
                <div className="truncate text-[10px] text-muted-foreground leading-tight">{shop.tagline}</div>
              )}
            </div>
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
              <Link to="/s/$slug/login" params={{ slug }} search={{ redirect: `/s/${slug}` }}>
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
