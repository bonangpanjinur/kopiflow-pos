import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resolve the public origin for a given shop. If the shop has a verified
 * custom domain, that domain is used; otherwise we fall back to the current
 * request host (lovable.app or similar) so URLs remain reachable.
 */
async function getRequestHost(): Promise<string> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const raw = (getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "").toLowerCase();
    return raw.split(":")[0] || "";
  } catch {
    return "";
  }
}

function makeOrigin(host: string) {
  if (!host) return "";
  const isLocal = host === "localhost" || host.startsWith("127.0.0.1");
  return `${isLocal ? "http" : "https"}://${host}`;
}

/**
 * Returns shop info plus the canonical base URL for that storefront.
 * If accessed via custom domain, baseUrl = https://<domain>/ (no /s/<slug>).
 * Otherwise baseUrl = https://<host>/s/<slug>.
 */
export const getShopForStorefront = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const v = input as { slug?: string };
    if (!v?.slug) throw new Error("slug_required");
    return { slug: String(v.slug) };
  })
  .handler(async ({ data }) => {
    const { data: shop } = await supabaseAdmin
      .from("coffee_shops")
      .select(
        "id, name, slug, description, tagline, logo_url, address, phone, whatsapp, open_hours, custom_domain, custom_domain_verified_at, is_active",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (!shop || !shop.is_active) {
      return { shop: null, baseUrl: "", canonicalPath: "" };
    }

    const reqHost = await getRequestHost();
    const verifiedCustom = shop.custom_domain && shop.custom_domain_verified_at ? shop.custom_domain : null;
    const onCustom = verifiedCustom && reqHost === verifiedCustom;

    const host = verifiedCustom ?? reqHost;
    const origin = makeOrigin(host);
    const baseUrl = onCustom || verifiedCustom ? `${origin}` : `${origin}/s/${shop.slug}`;

    return { shop, baseUrl, canonicalPath: baseUrl };
  });

/**
 * Lightweight menu item fetch for SSR head metadata.
 */
export const getMenuItemForStorefront = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const v = input as { slug?: string; menuId?: string };
    if (!v?.slug || !v?.menuId) throw new Error("invalid_input");
    return { slug: String(v.slug), menuId: String(v.menuId) };
  })
  .handler(async ({ data }) => {
    const { data: shop } = await supabaseAdmin
      .from("coffee_shops")
      .select("id, name, slug, custom_domain, custom_domain_verified_at, is_active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!shop || !shop.is_active) return { item: null, shop: null, baseUrl: "" };

    const { data: item } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, description, price, image_url, is_available")
      .eq("id", data.menuId)
      .eq("shop_id", shop.id)
      .maybeSingle();

    const reqHost = await getRequestHost();
    const verifiedCustom = shop.custom_domain && shop.custom_domain_verified_at ? shop.custom_domain : null;
    const host = verifiedCustom ?? reqHost;
    const origin = makeOrigin(host);
    const baseUrl = verifiedCustom ? origin : `${origin}/s/${shop.slug}`;

    return { item, shop, baseUrl };
  });
