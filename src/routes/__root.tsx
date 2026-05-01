import { Outlet, Link, createRootRoute, HeadContent, Scripts, redirect } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { PWAUpdater } from "@/components/PWAUpdater";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { createServerFn } from "@tanstack/react-start";

const resolveHost = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const rawHost = (getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "").toLowerCase();
  if (!rawHost) return { tenantSlug: null as string | null, host: "" };
  const host = rawHost.split(":")[0];

  if (
    host === "localhost" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host === "127.0.0.1"
  ) {
    return { tenantSlug: null, host };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("coffee_shops")
    .select("slug, custom_domain_verified_at")
    .eq("custom_domain", host)
    .maybeSingle();
  if (error || !data) return { tenantSlug: null, host };
  if (!data.custom_domain_verified_at) return { tenantSlug: null, host };
  return { tenantSlug: data.slug as string, host };
});

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Halaman tidak ditemukan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          URL yang Anda buka tidak ada atau sudah dipindah.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

// Paths that should remain on the platform even when accessed via a custom domain.
const PLATFORM_PREFIXES = ["/app", "/admin", "/login", "/signup", "/onboarding", "/invite", "/track", "/s/"];

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    // Only run host resolution on the server during SSR.
    if (typeof window !== "undefined") return;
    try {
      const { tenantSlug } = await resolveHost();
      if (!tenantSlug) return;
      const path = location.pathname;
      if (path === `/s/${tenantSlug}` || path.startsWith(`/s/${tenantSlug}/`)) return;
      if (PLATFORM_PREFIXES.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p))) return;
      const target = path === "/" ? `/s/${tenantSlug}` : `/s/${tenantSlug}${path}`;
      throw redirect({ to: target });
    } catch (e) {
      if ((e as { isRedirect?: boolean })?.isRedirect) throw e;
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KopiHub — POS & Marketplace untuk Coffeeshop" },
      {
        name: "description",
        content:
          "POS modern + marketplace untuk coffeeshop dengan kurir milik toko. Cepat, multi-cart, multi-outlet.",
      },
      { property: "og:title", content: "KopiHub — POS & Marketplace untuk Coffeeshop" },
      {
        property: "og:description",
        content:
          "POS modern + marketplace untuk coffeeshop dengan kurir milik toko. Cepat, multi-cart, multi-outlet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#0f172a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "KopiHub" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <PWAUpdater />
      <PushNotificationManager />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
