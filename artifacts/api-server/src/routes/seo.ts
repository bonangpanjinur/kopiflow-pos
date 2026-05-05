import { Router, type IRouter } from "express";
import { getSupabaseAdmin } from "../lib/supabase-admin";

const router: IRouter = Router();

router.get("/robots.txt", (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  const body =
    `User-agent: *\n` +
    `Disallow: /app/\n` +
    `Disallow: /admin/\n` +
    `Disallow: /api/\n` +
    `Disallow: /onboarding\n` +
    `Disallow: /invite/\n` +
    `Allow: /\n\n` +
    `Sitemap: ${origin}/sitemap.xml\n`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(body);
});

router.get("/sitemap.xml", async (req, res) => {
  const host = req.hostname;
  const origin = `${req.protocol}://${req.get("host")}`;
  const urls: { loc: string; lastmod?: string }[] = [];

  try {
    const db = getSupabaseAdmin();

    const { data: tenant } = await db
      .from("businesses")
      .select("id, slug, custom_domain_verified_at, is_active")
      .eq("custom_domain", host)
      .maybeSingle();

    if (tenant?.is_active && tenant.custom_domain_verified_at) {
      urls.push({ loc: `${origin}/` });
      const { data: items } = await db
        .from("menu_items")
        .select("id, updated_at")
        .eq("shop_id", tenant.id)
        .eq("is_available", true)
        .limit(2000);
      for (const it of items ?? []) {
        urls.push({ loc: `${origin}/menu/${it.id}`, lastmod: it.updated_at ?? undefined });
      }
    } else {
      urls.push({ loc: `${origin}/` });
      const { data: shops } = await db
        .from("businesses")
        .select("slug, updated_at")
        .eq("is_active", true)
        .limit(5000);
      for (const s of shops ?? []) {
        if (s.slug) {
          urls.push({ loc: `${origin}/s/${s.slug}`, lastmod: s.updated_at ?? undefined });
        }
      }
    }
  } catch {
    urls.push({ loc: `${origin}/` });
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

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.status(200).send(body);
});

export default router;
