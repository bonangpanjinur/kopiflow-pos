import { createFileRoute, Link, useParams, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { addToCart, itemUnitPrice } from "@/lib/customer-cart";
import type { SelectedOption } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Minus, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { createServerFn } from "@tanstack/react-start";

const getMenuItemForStorefront = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const v = input as { slug?: string; menuId?: string };
    if (!v?.slug || !v?.menuId) throw new Error("invalid_input");
    return { slug: String(v.slug), menuId: String(v.menuId) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop } = await supabaseAdmin
      .from("businesses")
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

    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const rawHost = (getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "").toLowerCase();
    const reqHost = rawHost.split(":")[0] || "";

    const verifiedCustom = shop.custom_domain && shop.custom_domain_verified_at ? shop.custom_domain : null;
    const host = verifiedCustom ?? reqHost;
    const isLocal = host === "localhost" || host.startsWith("127.0.0.1");
    const origin = host ? `${isLocal ? "http" : "https"}://${host}` : "";
    const baseUrl = verifiedCustom ? origin : `${origin}/s/${shop.slug}`;

    return { item, shop, baseUrl };
  });

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

type OptionGroup = {
  id: string;
  name: string;
  is_required: boolean;
  max_select: number;
  options: { id: string; name: string; price_adjustment: number }[];
};

function MenuDetail() {
  const { slug, menuId } = useParams({ from: "/s/$slug/menu/$menuId" });
  const navigate = useNavigate();
  const [item, setItem] = useState<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    shop_id: string;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [reviewStats, setReviewStats] = useState<{ avg: number; count: number; recent: { rating: number; comment: string | null; created_at: string }[] }>({ avg: 0, count: 0, recent: [] });

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("id,name,description,price,image_url,shop_id")
      .eq("id", menuId)
      .eq("is_available", true)
      .maybeSingle()
      .then(({ data }) => {
        setItem(data as typeof item);
        if (data) loadOptions(data.id, data.shop_id);
      });

    (supabase as any)
      .from("menu_reviews")
      .select("rating, comment, created_at")
      .eq("menu_item_id", menuId)
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }: any) => {
        const list = (data ?? []) as { rating: number; comment: string | null; created_at: string }[];
        if (list.length === 0) return;
        // get full count + avg via separate aggregate query
        (supabase as any)
          .from("menu_reviews")
          .select("rating", { count: "exact" })
          .eq("menu_item_id", menuId)
          .eq("is_visible", true)
          .then(({ data: all, count }: any) => {
            const ratings = (all ?? []).map((r: any) => r.rating);
            const avg = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
            setReviewStats({ avg, count: count ?? ratings.length, recent: list });
          });
      });
  }, [menuId]);

  async function loadOptions(itemId: string, shopId: string) {
    setLoadingOptions(true);
    const { data: grps } = await supabase
      .from("menu_item_option_groups")
      .select("id, name, is_required, max_select, sort_order")
      .eq("menu_item_id", itemId)
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true });

    if (!grps || grps.length === 0) {
      setOptionGroups([]);
      setLoadingOptions(false);
      return;
    }

    const groupIds = grps.map((g) => g.id);
    const { data: opts } = await supabase
      .from("menu_item_options")
      .select("id, group_id, name, price_adjustment, sort_order")
      .in("group_id", groupIds)
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    const optMap = new Map<string, { id: string; name: string; price_adjustment: number }[]>();
    for (const o of opts ?? []) {
      const list = optMap.get(o.group_id) ?? [];
      list.push({ id: o.id, name: o.name, price_adjustment: Number(o.price_adjustment) });
      optMap.set(o.group_id, list);
    }

    const full: OptionGroup[] = grps.map((g) => ({
      id: g.id,
      name: g.name,
      is_required: g.is_required,
      max_select: g.max_select,
      options: optMap.get(g.id) ?? [],
    }));

    setOptionGroups(full);
    const init: Record<string, string[]> = {};
    full.forEach((g) => { init[g.id] = []; });
    setSelections(init);
    setLoadingOptions(false);
  }

  function toggleOption(groupId: string, optionId: string, maxSelect: number) {
    setSelections((prev) => {
      const curr = prev[groupId] ?? [];
      if (curr.includes(optionId)) {
        return { ...prev, [groupId]: curr.filter((id) => id !== optionId) };
      }
      if (maxSelect === 1) return { ...prev, [groupId]: [optionId] };
      if (curr.length >= maxSelect) return prev;
      return { ...prev, [groupId]: [...curr, optionId] };
    });
  }

  if (!item) return <p className="text-muted-foreground text-sm">Memuat…</p>;

  const selectedOptions: SelectedOption[] = [];
  for (const g of optionGroups) {
    for (const optId of selections[g.id] ?? []) {
      const opt = g.options.find((o) => o.id === optId);
      if (opt) {
        selectedOptions.push({
          group_id: g.id,
          group_name: g.name,
          option_id: opt.id,
          option_name: opt.name,
          price_adjustment: opt.price_adjustment,
        });
      }
    }
  }

  const optAdj = selectedOptions.reduce((s, o) => s + o.price_adjustment, 0);
  const effectivePrice = Number(item.price) + optAdj;
  const allValid = optionGroups.every(
    (g) => !g.is_required || (selections[g.id] ?? []).length > 0,
  );

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
        <p className="mt-1 text-lg font-semibold text-primary">{formatIDR(effectivePrice)}</p>
        {reviewStats.count > 0 && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">{reviewStats.avg.toFixed(1)}</span>
            <span>({reviewStats.count} ulasan)</span>
          </div>
        )}
        {item.description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        )}
      </div>

      {reviewStats.recent.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-sm font-semibold">Ulasan terbaru</p>
          <div className="space-y-2">
            {reviewStats.recent.map((r, idx) => (
              <div key={idx} className="border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3 w-3 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("id-ID")}
                  </span>
                </div>
                {r.comment && <p className="mt-1 text-xs text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Option groups */}
      {loadingOptions ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : optionGroups.length > 0 && (
        <div className="space-y-4">
          {optionGroups.map((g) => (
            <div key={g.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">{g.name}</span>
                {g.is_required && (
                  <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Wajib</span>
                )}
              </div>
              {g.max_select === 1 ? (
                <RadioGroup
                  value={selections[g.id]?.[0] ?? ""}
                  onValueChange={(v) => setSelections((prev) => ({ ...prev, [g.id]: [v] }))}
                >
                  {g.options.map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={opt.id} id={`sf-${opt.id}`} />
                        <Label htmlFor={`sf-${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
                      </div>
                      {opt.price_adjustment !== 0 && (
                        <span className="text-xs text-muted-foreground">
                          {opt.price_adjustment > 0 ? "+" : ""}{formatIDR(opt.price_adjustment)}
                        </span>
                      )}
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-1">
                  {g.options.map((opt) => {
                    const checked = (selections[g.id] ?? []).includes(opt.id);
                    return (
                      <div key={opt.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`sf-${opt.id}`}
                            checked={checked}
                            onCheckedChange={() => toggleOption(g.id, opt.id, g.max_select)}
                          />
                          <Label htmlFor={`sf-${opt.id}`} className="text-sm cursor-pointer">{opt.name}</Label>
                        </div>
                        {opt.price_adjustment !== 0 && (
                          <span className="text-xs text-muted-foreground">
                            {opt.price_adjustment > 0 ? "+" : ""}{formatIDR(opt.price_adjustment)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
            disabled={!allValid}
            onClick={() => {
              addToCart(
                slug,
                {
                  menu_item_id: item.id,
                  name: item.name,
                  price: Number(item.price),
                  image_url: item.image_url,
                  note: note || undefined,
                  options: selectedOptions.length > 0 ? selectedOptions : undefined,
                },
                qty,
              );
              toast.success("Ditambahkan ke keranjang");
              navigate({ to: "/s/$slug", params: { slug } });
            }}
          >
            Tambah {formatIDR(effectivePrice * qty)}
          </Button>
        </div>
      </div>
    </div>
  );
}
