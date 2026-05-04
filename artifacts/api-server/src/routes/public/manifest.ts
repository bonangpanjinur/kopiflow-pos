import { Router, type IRouter } from "express";
import { getSupabaseAdmin } from "../../lib/supabase-admin";

const router: IRouter = Router();

router.get("/manifest/:slug", async (req, res) => {
  const { slug } = req.params;
  const db = getSupabaseAdmin() as any;

  const { data: shop } = await db
    .from("coffee_shops")
    .select("name, slug, logo_url, tagline, is_active, custom_domain, custom_domain_verified_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!shop || !shop.is_active) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const onCustomDomain = !!(shop.custom_domain && shop.custom_domain_verified_at);
  const startUrl = onCustomDomain ? "/" : `/s/${shop.slug}`;

  const manifest = {
    name: shop.name,
    short_name: (shop.name as string)?.slice(0, 12) || shop.slug,
    description: shop.tagline ?? `Pesan online dari ${shop.name}`,
    start_url: startUrl,
    scope: startUrl,
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

  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600");
  res.status(200).json(manifest);
});

export default router;
