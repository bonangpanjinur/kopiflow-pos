import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { addToCart } from "@/lib/customer-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/s/$slug/")({
  component: ShopHome,
});

type Cat = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_available: boolean;
};

function ShopHome() {
  const { slug } = useParams({ from: "/s/$slug/" });
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopDesc, setShopDesc] = useState<string | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: shop } = await supabase
        .from("coffee_shops")
        .select("id,description")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!shop) return;
      setShopId(shop.id);
      setShopDesc(shop.description);

      const [{ data: c }, { data: m }] = await Promise.all([
        supabase
          .from("categories")
          .select("id,name")
          .eq("shop_id", shop.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("menu_items")
          .select("id,name,description,price,image_url,category_id,is_available")
          .eq("shop_id", shop.id)
          .eq("is_available", true)
          .order("sort_order"),
      ]);
      setCats(c ?? []);
      setItems((m ?? []) as Item[]);
    })();
  }, [slug]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (activeCat !== "all" && i.category_id !== activeCat) return false;
      if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, activeCat, q]);

  if (!shopId) return <p className="text-muted-foreground text-sm">Memuat menu…</p>;

  return (
    <div className="space-y-4">
      {shopDesc && <p className="text-sm text-muted-foreground">{shopDesc}</p>}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari menu…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCat("all")}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
            activeCat === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border"
          }`}
        >
          Semua
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              activeCat === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((i) => (
          <div key={i.id} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            <Link
              to="/s/$slug/menu/$menuId"
              params={{ slug, menuId: i.id }}
              className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
            >
              {i.image_url ? (
                <img src={i.image_url} alt={i.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  Tidak ada foto
                </div>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link to="/s/$slug/menu/$menuId" params={{ slug, menuId: i.id }} className="min-w-0">
                <h3 className="truncate text-sm font-semibold">{i.name}</h3>
                {i.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{i.description}</p>
                )}
              </Link>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-sm font-semibold">{formatIDR(Number(i.price))}</span>
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2"
                  onClick={() => {
                    addToCart(slug, {
                      menu_item_id: i.id,
                      name: i.name,
                      price: Number(i.price),
                      image_url: i.image_url,
                    });
                    toast.success(`${i.name} ditambahkan`);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah
                </Button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Menu tidak ditemukan
          </p>
        )}
      </div>
    </div>
  );
}
