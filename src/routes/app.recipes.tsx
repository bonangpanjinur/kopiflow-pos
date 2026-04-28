import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/app/recipes")({
  component: RecipesPage,
});

type Menu = { id: string; name: string; track_stock: boolean };
type Ingredient = { id: string; name: string; unit: string; current_stock: number; cost_per_unit: number };
type Recipe = { id: string; menu_item_id: string; ingredient_id: string; quantity: number };
type HPPRow = { menu_item_id: string; hpp: number; margin: number; margin_percent: number; price: number; last_updated: string; recipe_count: number };

function RecipesPage() {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [hpp, setHpp] = useState<Record<string, HPPRow>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);

  // add row form
  const [newIng, setNewIng] = useState<string>("");
  const [newQty, setNewQty] = useState<string>("1");
  const [adding, setAdding] = useState(false);

  async function load() {
    if (!shop) return;
    setLoading(true);
    const [m, i, r, h] = await Promise.all([
      supabase.from("menu_items").select("id, name, track_stock").eq("shop_id", shop.id).order("name"),
      supabase.from("ingredients").select("id, name, unit, current_stock, cost_per_unit").eq("shop_id", shop.id).eq("is_active", true).order("name"),
      supabase.from("recipes").select("id, menu_item_id, ingredient_id, quantity"),
      supabase.from("menu_hpp_view").select("menu_item_id, hpp, margin, margin_percent, price, last_updated, recipe_count").eq("shop_id", shop.id),
    ]);
    setMenus((m.data ?? []) as Menu[]);
    setIngredients((i.data ?? []) as Ingredient[]);
    setRecipes((r.data ?? []) as Recipe[]);
    const hMap: Record<string, HPPRow> = {};
    ((h.data ?? []) as HPPRow[]).forEach((row) => { if (row.menu_item_id) hMap[row.menu_item_id] = row; });
    setHpp(hMap);
    setLoading(false);
    if (!selectedMenu && m.data && m.data.length > 0) {
      setSelectedMenu(m.data[0].id);
    }
  }

  useEffect(() => {
    if (shop) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id]);

  const current = menus.find((m) => m.id === selectedMenu) ?? null;
  const menuRecipes = recipes.filter((r) => r.menu_item_id === selectedMenu);

  async function toggleTrack(checked: boolean) {
    if (!current) return;
    const { error } = await supabase.from("menu_items").update({ track_stock: checked }).eq("id", current.id);
    if (error) toast.error(error.message);
    else {
      toast.success(checked ? "Stok bahan akan dikurangi otomatis" : "Pengurangan stok dimatikan");
      load();
    }
  }

  async function addRecipe() {
    if (!current || !newIng || !newQty) return;
    const qty = Number(newQty);
    if (!qty || qty <= 0) {
      toast.error("Jumlah tidak valid");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("recipes").insert({
      menu_item_id: current.id,
      ingredient_id: newIng,
      quantity: qty,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Resep ditambahkan");
      setNewIng("");
      setNewQty("1");
      load();
    }
    setAdding(false);
  }

  async function removeRecipe(id: string) {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Dihapus");
      load();
    }
  }

  if (shopLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (menus.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <ChefHat className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Belum ada menu</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Tambahkan menu di halaman Menu dulu.</p>
        </div>
      </div>
    );
  }

  const availableIngs = ingredients.filter(
    (i) => !menuRecipes.some((r) => r.ingredient_id === i.id)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Resep</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hubungkan menu dengan bahan baku. Saat menu terjual, stok bahan akan berkurang otomatis.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-4">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              MENU
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {menus.map((m) => {
                const count = recipes.filter((r) => r.menu_item_id === m.id).length;
                const active = selectedMenu === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMenu(m.id)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                      active ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="ml-2 flex items-center gap-1.5">
                      {m.track_stock && (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          ON
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="col-span-12 md:col-span-8">
          {current ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{current.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      Aktifkan untuk mengurangi stok bahan saat menu ini terjual.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Lacak stok</span>
                    <Switch checked={current.track_stock} onCheckedChange={toggleTrack} />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Bahan</th>
                      <th className="px-4 py-2.5 text-right">Jumlah / 1 porsi</th>
                      <th className="px-4 py-2.5 text-right">Stok saat ini</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {menuRecipes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                          Belum ada bahan. Tambahkan di bawah.
                        </td>
                      </tr>
                    ) : (
                      menuRecipes.map((r) => {
                        const ing = ingredients.find((i) => i.id === r.ingredient_id);
                        return (
                          <tr key={r.id}>
                            <td className="px-4 py-2.5 font-medium">{ing?.name ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {r.quantity} {ing?.unit}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                              {ing?.current_stock} {ing?.unit}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeRecipe(r.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-dashed border-border bg-card p-3">
                <Label className="text-xs text-muted-foreground">Tambah bahan ke resep</Label>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[160px]">
                    <Select value={newIng} onValueChange={setNewIng}>
                      <SelectTrigger>
                        <SelectValue placeholder={availableIngs.length === 0 ? "Semua bahan sudah ditambahkan" : "Pilih bahan"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableIngs.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      placeholder="Jumlah"
                    />
                  </div>
                  <Button onClick={addRecipe} disabled={adding || !newIng}>
                    {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                    Tambah
                  </Button>
                </div>
                {ingredients.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Belum ada bahan. Tambahkan dulu di halaman Inventori.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
