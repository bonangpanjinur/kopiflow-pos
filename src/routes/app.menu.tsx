import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, UtensilsCrossed, Upload, ImageIcon, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/menu")({
  component: MenuPage,
});

type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string | null;
  track_stock: boolean;
  recipe_yield: number;
};

type HPPRow = {
  menu_item_id: string;
  hpp: number;
  margin: number;
  margin_percent: number;
  recipe_count: number;
};

type RecipeRow = {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity: number;
};

type IngredientRow = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
};

const NO_CATEGORY = "__none__";

function MenuPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const [hpp, setHpp] = useState<Record<string, HPPRow>>({});
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [ingredients, setIngredients] = useState<Record<string, IngredientRow>>({});

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
  const [available, setAvailable] = useState(true);
  const [trackStock, setTrackStock] = useState(false);
  const [recipeYield, setRecipeYield] = useState<string>("1");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const [cats, mi, hp, rc, ing] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name")
        .eq("shop_id", shop.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, is_available, category_id, track_stock, recipe_yield")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("menu_hpp_view")
        .select("menu_item_id, hpp, margin, margin_percent, recipe_count")
        .eq("shop_id", shop.id),
      supabase
        .from("recipes")
        .select("id, menu_item_id, ingredient_id, quantity"),
      supabase
        .from("ingredients")
        .select("id, name, unit, current_stock, min_stock, cost_per_unit")
        .eq("shop_id", shop.id)
        .eq("is_active", true),
    ]);
    if (cats.error) toast.error(cats.error.message);
    if (mi.error) toast.error(mi.error.message);
    setCategories(cats.data ?? []);
    setItems((mi.data ?? []) as MenuItem[]);
    const hMap: Record<string, HPPRow> = {};
    ((hp.data ?? []) as HPPRow[]).forEach((row) => { if (row.menu_item_id) hMap[row.menu_item_id] = row; });
    setHpp(hMap);
    setRecipes((rc.data ?? []) as RecipeRow[]);
    const iMap: Record<string, IngredientRow> = {};
    ((ing.data ?? []) as IngredientRow[]).forEach((i) => { iMap[i.id] = i; });
    setIngredients(iMap);
    setLoading(false);
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id]);

  function openNew() {
    setEditing(null);
    setName("");
    setDesc("");
    setPrice("");
    setCategoryId(NO_CATEGORY);
    setAvailable(true);
    setTrackStock(false);
    setRecipeYield("1");
    setImageUrl(null);
    setOpen(true);
  }

  function openEdit(it: MenuItem) {
    setEditing(it);
    setName(it.name);
    setDesc(it.description ?? "");
    setPrice(String(it.price));
    setCategoryId(it.category_id ?? NO_CATEGORY);
    setAvailable(it.is_available);
    setTrackStock(Boolean(it.track_stock));
    setRecipeYield(String(it.recipe_yield ?? 1));
    setImageUrl(it.image_url);
    setOpen(true);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !shop) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maksimal 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${shop.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("menu-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error(error.message);
    } else {
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!shop || !name.trim()) return;
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Harga tidak valid");
      return;
    }
    setSaving(true);
    const yieldNum = Math.max(1, Number(recipeYield) || 1);
    const payload = {
      shop_id: shop.id,
      name: name.trim(),
      description: desc.trim() || null,
      price: priceNum,
      image_url: imageUrl,
      is_available: available,
      category_id: categoryId === NO_CATEGORY ? null : categoryId,
      track_stock: trackStock,
      recipe_yield: yieldNum,
    };
    if (editing) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Menu diperbarui");
    } else {
      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Menu ditambahkan");
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function remove(it: MenuItem) {
    if (!confirm(`Hapus menu "${it.name}"?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Menu dihapus");
      load();
    }
  }

  const filtered = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === NO_CATEGORY) return !it.category_id;
    return it.category_id === filter;
  });

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Daftar produk yang dijual. Bisa dipakai di POS dan etalase publik.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              <SelectItem value={NO_CATEGORY}>Tanpa kategori</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Menu baru
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit menu" : "Menu baru"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 transition-colors hover:bg-muted"
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                  />
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="m-name">Nama</Label>
                    <Input
                      id="m-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mis. Cappuccino"
                    />
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl(null)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Hapus foto
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-price">Harga (Rp)</Label>
                    <Input
                      id="m-price"
                      type="number"
                      inputMode="numeric"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="25000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kategori</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>Tanpa kategori</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="m-desc">Deskripsi (opsional)</Label>
                  <Textarea
                    id="m-desc"
                    rows={2}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Espresso + susu steam, ringan."
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">Tersedia</div>
                    <div className="text-xs text-muted-foreground">
                      Item nonaktif tidak muncul di POS & etalase.
                    </div>
                  </div>
                  <Switch checked={available} onCheckedChange={setAvailable} />
                </div>

                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">Lacak stok bahan</div>
                    <div className="text-xs text-muted-foreground">
                      Stok bahan dikurangi otomatis saat menu ini terjual.
                    </div>
                  </div>
                  <Switch checked={trackStock} onCheckedChange={setTrackStock} />
                </div>

                <div className="space-y-1.5">
                  <Label>Yield resep (porsi per resep)</Label>
                  <Input type="number" min={1} step="1" value={recipeYield}
                    onChange={(e) => setRecipeYield(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">
                    Mis. 1 batch sirup → 20 porsi. HPP per porsi = total bahan ÷ yield.
                  </p>
                </div>

                {editing && (() => {
                  const h = hpp[editing.id];
                  const rs = recipes.filter((r) => r.menu_item_id === editing.id);
                  if (!h && rs.length === 0) {
                    return (
                      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        Belum ada resep untuk menu ini. Tambahkan di halaman <strong>Resep</strong> agar HPP & margin terhitung.
                      </div>
                    );
                  }
                  const pct = Number(h?.margin_percent ?? 0);
                  const tone = pct >= 30 ? "text-emerald-600" : pct >= 10 ? "text-amber-600" : "text-destructive";
                  return (
                    <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-wide text-muted-foreground">Breakdown HPP</span>
                        <span className={`font-bold ${tone}`}>Margin {pct}%</span>
                      </div>
                      <div className="flex justify-between"><span>HPP</span><span className="tabular-nums font-medium">{formatIDR(Number(h?.hpp ?? 0))}</span></div>
                      <div className="flex justify-between"><span>Harga</span><span className="tabular-nums font-medium">{formatIDR(Number(price) || 0)}</span></div>
                      <div className="flex justify-between"><span>Margin</span><span className="tabular-nums font-medium">{formatIDR(Number(h?.margin ?? 0))}</span></div>
                      {rs.length > 0 && (
                        <div className="border-t border-border pt-1.5 mt-1.5 space-y-0.5">
                          {rs.map((r) => {
                            const ig = ingredients[r.ingredient_id];
                            return (
                              <div key={r.id} className="flex justify-between text-muted-foreground">
                                <span>{ig?.name ?? "—"} × {r.quantity}{ig?.unit ? ` ${ig.unit}` : ""}</span>
                                <span className="tabular-nums">{formatIDR((ig?.cost_per_unit ?? 0) * r.quantity)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button onClick={save} disabled={saving || uploading || !name.trim()}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Belum ada menu</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Tambahkan item pertama Anda — minuman, makanan, atau merchandise.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => {
            const cat = categories.find((c) => c.id === it.category_id)?.name;
            const h = hpp[it.id];
            const pct = Number(h?.margin_percent ?? 0);
            const hasHpp = !!h && Number(h.hpp) > 0;
            const marginTone = pct >= 30 ? "text-emerald-700 bg-emerald-500/15"
              : pct >= 10 ? "text-amber-700 bg-amber-500/15"
              : "text-destructive bg-destructive/15";
            // Low-stock check: any recipe ingredient at/under min stock
            const itemRecipes = recipes.filter((r) => r.menu_item_id === it.id);
            const lowIngs = itemRecipes
              .map((r) => ingredients[r.ingredient_id])
              .filter((ig): ig is IngredientRow => !!ig && ig.min_stock > 0 && Number(ig.current_stock) <= Number(ig.min_stock));
            const outIngs = itemRecipes
              .map((r) => ({ r, ig: ingredients[r.ingredient_id] }))
              .filter(({ r, ig }) => ig && Number(ig.current_stock) < Number(r.quantity));
            return (
              <div
                key={it.id}
                className="group flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{it.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cat ?? "Tanpa kategori"}
                      </div>
                    </div>
                    {!it.is_available && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        Off
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{formatIDR(it.price)}</span>
                    {hasHpp && (
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${marginTone}`}
                        title={`HPP ${formatIDR(Number(h.hpp))} · Margin ${formatIDR(Number(h.margin))}`}>
                        {pct >= 10 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {pct}%
                      </span>
                    )}
                    {it.track_stock && outIngs.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive"
                        title={`Bahan kurang: ${outIngs.map(({ ig }) => ig?.name).join(", ")}`}>
                        <AlertTriangle className="h-2.5 w-2.5" /> Habis
                      </span>
                    )}
                    {it.track_stock && outIngs.length === 0 && lowIngs.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                        title={`Bahan menipis: ${lowIngs.map((ig) => ig.name).join(", ")}`}>
                        <AlertTriangle className="h-2.5 w-2.5" /> Low {lowIngs.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-1 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(it)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(it)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
