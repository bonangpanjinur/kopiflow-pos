import { createFileRoute, Link, useParams, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { addToCart } from "@/lib/customer-cart";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { getMenuItemForStorefront } from "@/server/tenant.functions";

export const Route = createFileRoute("/s/$slug/menu/$menuId")({
  loader: async ({ params }) => {
    const res = await getMenuItemForStorefront({
      data: { slug: params.slug, menuId: params.menuId },
    });
    if (!res.item || !res.shop) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.item || !loaderData?.shop) return {};
    const { item, shop, baseUrl } = loaderData;
    const title = `${item.name} — ${shop.name}`;
    const description = item.description ?? `Pesan ${item.name} dari ${shop.name}.`;
    const url = `${baseUrl}/menu/${item.id}`;
    const image = item.image_url ?? undefined;
    const ld = {
      "@context": "https://schema.org",
      "@type": "MenuItem",
      name: item.name,
      description,
      image: image ? [image] : undefined,
      offers: {
        "@type": "Offer",
        price: Number(item.price),
        priceCurrency: "IDR",
        availability: item.is_available
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
  component: MenuDetail,
  notFoundComponent: () => (
    <div className="py-16 text-center text-sm text-muted-foreground">Menu tidak ditemukan</div>
  ),
});

function MenuDetail() {
  const { slug, menuId } = useParams({ from: "/s/$slug/menu/$menuId" });
  const navigate = useNavigate();
  const [item, setItem] = useState<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("id,name,description,price,image_url")
      .eq("id", menuId)
      .eq("is_available", true)
      .maybeSingle()
      .then(({ data }) => setItem(data as typeof item));
  }, [menuId]);

  if (!item) return <p className="text-muted-foreground text-sm">Memuat…</p>;

  return (
    <div className="space-y-4 pb-24">
      <Link
        to="/s/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>

      <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Tidak ada foto
          </div>
        )}
      </div>

      <div>
        <h1 className="text-xl font-semibold">{item.name}</h1>
        <p className="mt-1 text-lg font-semibold text-primary">{formatIDR(Number(item.price))}</p>
        {item.description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Catatan</label>
        <Textarea
          placeholder="Less sugar, no ice, dll."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex items-center rounded-md border border-border">
            <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center text-sm font-semibold">{qty}</span>
            <Button variant="ghost" size="icon" onClick={() => setQty(qty + 1)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="flex-1"
            onClick={() => {
              addToCart(
                slug,
                {
                  menu_item_id: item.id,
                  name: item.name,
                  price: Number(item.price),
                  image_url: item.image_url,
                  note: note || undefined,
                },
                qty,
              );
              toast.success("Ditambahkan ke keranjang");
              navigate({ to: "/s/$slug", params: { slug } });
            }}
          >
            Tambah {formatIDR(Number(item.price) * qty)}
          </Button>
        </div>
      </div>
    </div>
  );
}
