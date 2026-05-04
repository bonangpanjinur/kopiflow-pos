import { useState } from "react";
import { Search, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";

type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_available: boolean;
};

interface MenuGridProps {
  categories: Category[];
  items: MenuItem[];
  onItemClick: (item: MenuItem) => void;
  loading?: boolean;
}

export function MenuGrid({ categories, items, onItemClick, loading }: MenuGridProps) {
  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = items.filter((it) => {
    const matchCat = activeCat === "all" || it.category_id === activeCat;
    const matchSearch = it.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-muted/30">
      {/* Search & Categories */}
      <div className="border-b bg-background p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari menu..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveCat("all")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCat === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCat === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Search className="mb-2 h-8 w-8 opacity-20" />
            <p className="text-sm">Menu tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((it) => (
              <button
                key={it.id}
                onClick={() => onItemClick(it)}
                className="group flex flex-col overflow-hidden rounded-xl border bg-background text-left transition-all hover:border-primary hover:ring-1 hover:ring-primary"
              >
                <div className="relative aspect-square w-full bg-muted">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 text-sm font-medium leading-tight">{it.name}</div>
                  <div className="mt-1 text-sm font-bold text-primary">{formatIDR(it.price)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
