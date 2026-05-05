import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/manifest/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data: shop } = await supabaseAdmin
          .from("businesses")
          .select("name, slug, logo_url, tagline, is_active, custom_domain, custom_domain_verified_at")
          .eq("slug", params.slug)
          .maybeSingle();

        if (!shop || !shop.is_active) {
          return new Response("not_found", { status: 404 });
        }

        const onCustomDomain = !!(shop.custom_domain && shop.custom_domain_verified_at);
        const startUrl = onCustomDomain ? "/" : `/s/${shop.slug}`;
        const scope = startUrl;

        const manifest = {
          name: shop.name,
          short_name: shop.name?.slice(0, 12) || shop.slug,
          description: shop.tagline ?? `Pesan online dari ${shop.name}`,
          start_url: startUrl,
          scope,
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#0f172a",
          orientation: "portrait",
          icons: shop.logo_url
            ? [
                { src: shop.logo_url, sizes: "192x192", type: "image/png", purpose: "any" },
                { src: shop.logo_url, sizes: "512x512", type: "image/png", purpose: "any" },
              ]
            : [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=600",
          },
        });
      },
    },
  },
});
