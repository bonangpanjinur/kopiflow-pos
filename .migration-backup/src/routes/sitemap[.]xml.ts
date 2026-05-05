import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const host = url.hostname;
        const origin = `${url.protocol}//${url.host}`;

        // Custom-domain mode: only show this tenant's URLs
        const { data: tenant } = await supabaseAdmin
          .from("businesses")
          .select("id, slug, custom_domain_verified_at, is_active")
          .eq("custom_domain", host)
          .maybeSingle();

        const urls: { loc: string; lastmod?: string }[] = [];

        if (tenant && tenant.is_active && tenant.custom_domain_verified_at) {
          urls.push({ loc: `${origin}/` });
          const { data: items } = await supabaseAdmin
            .from("menu_items")
            .select("id, updated_at")
            .eq("shop_id", tenant.id)
            .eq("is_available", true)
            .limit(2000);
          for (const it of items ?? []) {
            urls.push({ loc: `${origin}/menu/${it.id}`, lastmod: it.updated_at ?? undefined });
          }
        } else {
          // Platform mode: list active shops on the marketing domain
          urls.push({ loc: `${origin}/` });
          const { data: shops } = await supabaseAdmin
            .from("businesses")
            .select("slug, updated_at")
            .eq("is_active", true)
            .limit(5000);
          for (const s of shops ?? []) {
            urls.push({ loc: `${origin}/s/${s.slug}`, lastmod: s.updated_at ?? undefined });
          }
        }

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls
            .map(
              (u) =>
                `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
            )
            .join("\n") +
          `\n</urlset>\n`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=600",
          },
        });
      },
    },
  },
});
