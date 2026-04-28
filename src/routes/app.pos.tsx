import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentShop } from "@/lib/use-shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingBag,
  X,
  Save,
  Banknote,
  QrCode,
  Printer,
  Check,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import type { CartItem } from "@/lib/cart";
import { cartCount, cartTotal } from "@/lib/cart";
import { Receipt } from "@/components/pos/receipt";

export const Route = createFileRoute("/app/pos")({
  component: POSPage,
});

type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_available: boolean;
};
type OpenBill = {
  id: string;
  label: string;
  items: CartItem[];
  updated_at: string;
};

type LocalCart = {
  /** server id when parked, otherwise null */
  id: string | null;
  label: string;
  items: CartItem[];
};

function newCart(label = "Cart 1"): LocalCart {
  return { id: null, label, items: [] };
}

function storageKey(outletId: string) {
  return `kopihub.pos.carts.${outletId}`;
}

type Persisted = { carts: LocalCart[]; activeIdx: number };

function loadPersisted(outletId: string): Persisted | null {
  try {
    const raw = localStorage.getItem(storageKey(outletId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    if (!Array.isArray(p.carts) || p.carts.length === 0) return null;
    return p;
  } catch {
    return null;
  }
}

function POSPage() {
  const { user } = useAuth();
  const { shop, outlet, loading: shopLoading } = useCurrentShop();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [carts, setCarts] = useState<LocalCart[]>([newCart()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [tab, setTab] = useState<"register" | "bills">("register");

  const [parkOpen, setParkOpen] = useState(false);
  const [parkLabel, setParkLabel] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const cart = carts[activeIdx] ?? carts[0];
  const total = useMemo(() => (cart ? cartTotal(cart.items) : 0), [cart]);

  // Load menu
  useEffect(() => {
    if (!shop) return;
    (async () => {
      setLoading(true);
      const [cats, mi] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name")
          .eq("shop_id", shop.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("menu_items")
          .select("id, name, price, image_url, category_id, is_available")
          .eq("shop_id", shop.id)
          .eq("is_available", true)
          .order("name", { ascending: true }),
      ]);
      setCategories(cats.data ?? []);
      setItems((mi.data ?? []) as MenuItem[]);
      setLoading(false);
    })();
  }, [shop?.id]);

  // Hydrate local tabs from localStorage + reconcile with server
  useEffect(() => {
    if (!outlet) return;
    let mounted = true;
    (async () => {
      const persisted = loadPersisted(outlet.id);
      const serverBills = await supabase
        .from("open_bills")
        .select("id, label, items, updated_at")
        .eq("outlet_id", outlet.id)
        .order("updated_at", { ascending: false });
      if (!mounted) return;

      const bills = (serverBills.data ?? []) as OpenBill[];
      setOpenBills(bills);
      const byId = new Map(bills.map((b) => [b.id, b]));

      if (persisted) {
        const reconciled: LocalCart[] = persisted.carts.map((c) => {
          if (!c.id) return c; // local-only, keep
          const fresh = byId.get(c.id);
          if (!fresh) {
            // bill removed on server → keep items locally as new draft
            return { id: null, label: c.label, items: c.items };
          }
          // refresh from server (server is source of truth)
          return {
            id: fresh.id,
            label: fresh.label,
            items: (fresh.items ?? []) as CartItem[],
          };
        });
        setCarts(reconciled);
        setActiveIdx(Math.min(persisted.activeIdx, reconciled.length - 1));
      }
      setHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, [outlet?.id]);

  // Persist local tabs whenever they change
  useEffect(() => {
    if (!outlet || !hydrated) return;
    try {
      localStorage.setItem(storageKey(outlet.id), JSON.stringify({ carts, activeIdx }));
    } catch {
      /* ignore quota */
    }
  }, [carts, activeIdx, outlet?.id, hydrated]);

  // Subscribe to open_bills realtime updates
  useEffect(() => {
    if (!outlet) return;

    async function reload() {
      const { data } = await supabase
        .from("open_bills")
        .select("id, label, items, updated_at")
        .eq("outlet_id", outlet!.id)
        .order("updated_at", { ascending: false });
      const bills = (data ?? []) as OpenBill[];
      setOpenBills(bills);
      // Sync any open local tab that mirrors a server bill
      setCarts((cs) => {
        const byId = new Map(bills.map((b) => [b.id, b]));
        return cs.map((c) => {
          if (!c.id) return c;
          const fresh = byId.get(c.id);
          if (!fresh) {
            // server bill gone — detach so local edits become a new draft
            return { id: null, label: c.label, items: c.items };
          }
          return {
            id: fresh.id,
            label: fresh.label,
            items: (fresh.items ?? []) as CartItem[],
          };
        });
      });
    }

    const channel = supabase
      .channel(`open_bills_${outlet.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "open_bills", filter: `outlet_id=eq.${outlet.id}` },
        () => reload(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [outlet?.id]);

  function addToCart(it: MenuItem) {
    setCarts((cs) => {
      const next = cs.slice();
      const c = { ...next[activeIdx] };
      const found = c.items.findIndex((x) => x.menu_item_id === it.id);
      if (found >= 0) {
        c.items = c.items.map((x, i) =>
          i === found ? { ...x, quantity: x.quantity + 1 } : x,
        );
      } else {
        c.items = [
          ...c.items,
          { menu_item_id: it.id, name: it.name, unit_price: Number(it.price), quantity: 1 },
        ];
      }
      next[activeIdx] = c;
      return next;
    });
  }

  function changeQty(idx: number, delta: number) {
    setCarts((cs) => {
      const next = cs.slice();
      const c = { ...next[activeIdx] };
      const cur = c.items[idx];
      const q = cur.quantity + delta;
      if (q <= 0) c.items = c.items.filter((_, i) => i !== idx);
      else c.items = c.items.map((x, i) => (i === idx ? { ...x, quantity: q } : x));
      next[activeIdx] = c;
      return next;
    });
  }

  function removeLine(idx: number) {
    setCarts((cs) => {
      const next = cs.slice();
      const c = { ...next[activeIdx] };
      c.items = c.items.filter((_, i) => i !== idx);
      next[activeIdx] = c;
      return next;
    });
  }

  function newCartTab() {
    setCarts((cs) => {
      const next = [...cs, newCart(`Cart ${cs.length + 1}`)];
      setActiveIdx(next.length - 1);
      return next;
    });
  }

  function closeCartTab(i: number) {
    setCarts((cs) => {
      if (cs.length === 1) {
        setActiveIdx(0);
        return [newCart()];
      }
      const next = cs.filter((_, idx) => idx !== i);
      setActiveIdx((cur) => {
        if (i < cur) return cur - 1;
        if (i === cur) return Math.min(cur, next.length - 1);
        return cur;
      });
      return next;
    });
  }

  async function parkCart() {
    if (!outlet || !user || !shop) return;
    if (cart.items.length === 0) {
      toast.error("Cart kosong");
      return;
    }
    const label = parkLabel.trim() || cart.label || "Cart";
    if (cart.id) {
      const { error } = await supabase
        .from("open_bills")
        .update({
          label,
          items: cart.items as unknown as never,
          updated_by: user.id,
        })
        .eq("id", cart.id);
      if (error) return toast.error(error.message);
      // reflect new label locally
      setCarts((cs) =>
        cs.map((c, i) => (i === activeIdx ? { ...c, label } : c)),
      );
      toast.success("Bill diperbarui");
    } else {
      const { data, error } = await supabase
        .from("open_bills")
        .insert({
          outlet_id: outlet.id,
          shop_id: shop.id,
          label,
          items: cart.items as unknown as never,
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single();
      if (error || !data) return toast.error(error?.message ?? "Gagal");
      // park & remove from local tabs
      setCarts((cs) => {
        const next = cs.filter((_, i) => i !== activeIdx);
        const final = next.length ? next : [newCart()];
        setActiveIdx(0);
        return final;
      });
      toast.success(`Bill "${label}" diparkir`);
    }
    setParkOpen(false);
    setParkLabel("");
  }

  async function resumeBill(b: OpenBill) {
    // If already open in a local tab, just switch to it
    const existingIdx = carts.findIndex((c) => c.id === b.id);
    if (existingIdx >= 0) {
      setActiveIdx(existingIdx);
      setTab("register");
      return;
    }
    setCarts((cs) => {
      const next = [...cs, { id: b.id, label: b.label, items: (b.items ?? []) as CartItem[] }];
      setActiveIdx(next.length - 1);
      return next;
    });
    setTab("register");
  }

  async function deleteBill(b: OpenBill) {
    if (!confirm(`Hapus open bill "${b.label}"?`)) return;
    const { error } = await supabase.from("open_bills").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    else toast.success("Bill dihapus");
  }

  const filtered = items.filter((it) => {
    if (activeCat !== "all" && it.category_id !== activeCat) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (shopLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!outlet) {
    return (
      <div className="p-10 text-sm text-muted-foreground">Outlet tidak ditemukan.</div>
    );
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab("register")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "register" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Register
          </button>
          <button
            onClick={() => setTab("bills")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "bills" ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            Open Bills
            {openBills.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {openBills.length}
              </span>
            )}
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {shop?.name} · {outlet.name}
        </div>
      </div>

      {tab === "register" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Menu side */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-border">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Cari menu…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2">
              <CatChip
                label="Semua"
                active={activeCat === "all"}
                onClick={() => setActiveCat("all")}
              />
              {categories.map((c) => (
                <CatChip
                  key={c.id}
                  label={c.name}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                />
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-sm text-muted-foreground">
                  Tidak ada menu.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filtered.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => addToCart(it)}
                      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                    >
                      <div className="aspect-square w-full bg-muted">
                        {it.image_url ? (
                          <img
                            src={it.image_url}
                            alt={it.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="truncate text-sm font-medium">{it.name}</div>
                        <div className="text-xs font-semibold text-primary">
                          {formatIDR(it.price)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart side */}
          <div className="flex w-[380px] flex-col bg-card">
            {/* Cart tabs */}
            <div className="flex items-center gap-1 border-b border-border px-2 py-2">
              <div className="flex flex-1 items-center gap-1 overflow-x-auto">
                {carts.map((c, i) => (
                  <div
                    key={i}
                    className={`group flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      i === activeIdx
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    <button onClick={() => setActiveIdx(i)} className="font-medium">
                      {c.label}
                      {c.items.length > 0 && (
                        <span className="ml-1 opacity-70">· {cartCount(c.items)}</span>
                      )}
                    </button>
                    <button
                      onClick={() => closeCartTab(i)}
                      className="opacity-50 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newCartTab}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Cart body */}
            <div className="flex-1 overflow-auto px-3 py-2">
              {cart.items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
                  Klik produk untuk mulai.
                </div>
              ) : (
                <ul className="space-y-2">
                  {cart.items.map((line, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-background p-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{line.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatIDR(line.unit_price)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeLine(i)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-md border border-border">
                          <button
                            onClick={() => changeQty(i, -1)}
                            className="px-2 py-1 hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-sm font-medium">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() => changeQty(i, +1)}
                            className="px-2 py-1 hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-sm font-semibold">
                          {formatIDR(line.unit_price * line.quantity)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cart footer */}
            <div className="border-t border-border p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold">{formatIDR(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setParkLabel(cart.label);
                    setParkOpen(true);
                  }}
                  disabled={cart.items.length === 0}
                >
                  <Save className="mr-1.5 h-4 w-4" /> Park
                </Button>
                <Button
                  onClick={() => setCheckoutOpen(true)}
                  disabled={cart.items.length === 0}
                >
                  Bayar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <BillsTab bills={openBills} onResume={resumeBill} onDelete={deleteBill} />
      )}

      {/* Park dialog */}
      <Dialog open={parkOpen} onOpenChange={setParkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cart?.id ? "Update bill" : "Park bill"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="park-label">Nama meja / pelanggan</Label>
            <Input
              id="park-label"
              value={parkLabel}
              onChange={(e) => setParkLabel(e.target.value)}
              placeholder="Mis. Meja 4 / Andi"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Bill akan tersinkron ke semua device kasir di outlet ini.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setParkOpen(false)}>
              Batal
            </Button>
            <Button onClick={parkCart}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {checkoutOpen && cart && shop && outlet && (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          cart={cart}
          shop={shop}
          outlet={outlet}
          cashierId={user!.id}
          cashierName={user!.email ?? "Kasir"}
          onSuccess={() => {
            // remove parked bill if checked out from one
            if (cart.id) {
              supabase.from("open_bills").delete().eq("id", cart.id).then(() => {});
            }
            setCarts((cs) => {
              const next = cs.filter((_, i) => i !== activeIdx);
              return next.length ? next : [newCart()];
            });
            setActiveIdx(0);
          }}
        />
      )}
    </div>
  );
}

function CatChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {label}
    </button>
  );
}

function BillsTab({
  bills,
  onResume,
  onDelete,
}: {
  bills: OpenBill[];
  onResume: (b: OpenBill) => void;
  onDelete: (b: OpenBill) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-6">
      {bills.length === 0 ? (
        <div className="mx-auto max-w-md rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Tidak ada open bill</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Cart yang diparkir akan muncul di sini dan bisa dibuka dari device kasir mana pun.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bills.map((b) => {
            const items = (b.items ?? []) as CartItem[];
            return (
              <div key={b.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{b.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(b.updated_at).toLocaleString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(b)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ul className="my-3 space-y-0.5 text-sm">
                  {items.slice(0, 4).map((i, k) => (
                    <li key={k} className="flex justify-between gap-2 text-muted-foreground">
                      <span className="truncate">
                        {i.quantity}× {i.name}
                      </span>
                      <span>{formatIDR(i.unit_price * i.quantity)}</span>
                    </li>
                  ))}
                  {items.length > 4 && (
                    <li className="text-xs text-muted-foreground">
                      +{items.length - 4} item lain
                    </li>
                  )}
                </ul>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-semibold">{formatIDR(cartTotal(items))}</div>
                  </div>
                  <Button size="sm" onClick={() => onResume(b)}>
                    Lanjutkan
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckoutDialog({
  open,
  onOpenChange,
  cart,
  shop,
  outlet,
  cashierId,
  cashierName,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cart: LocalCart;
  shop: { id: string; name: string };
  outlet: { id: string; name: string };
  cashierId: string;
  cashierName: string;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<"cash" | "qris">("cash");
  const [tendered, setTendered] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{
    orderNo: string;
    date: Date;
    amountTendered: number;
    changeDue: number;
  } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const total = cartTotal(cart.items);
  const tenderedNum = method === "cash" ? Number(tendered || 0) : total;
  const change = Math.max(0, tenderedNum - total);
  const cashOk = method !== "cash" || tenderedNum >= total;

  async function checkout() {
    setSaving(true);
    // 1. get next order number
    const { data: noData, error: noErr } = await supabase.rpc("next_order_no", {
      _outlet_id: outlet.id,
    });
    if (noErr || !noData) {
      setSaving(false);
      return toast.error(noErr?.message ?? "Gagal generate nomor");
    }
    const orderNo = noData as string;

    // 2. insert order
    const { data: orderRow, error: oErr } = await supabase
      .from("orders")
      .insert({
        shop_id: shop.id,
        outlet_id: outlet.id,
        order_no: orderNo,
        subtotal: total,
        total,
        payment_method: method,
        amount_tendered: method === "cash" ? tenderedNum : total,
        change_due: change,
        cashier_id: cashierId,
      })
      .select("id, created_at")
      .single();

    if (oErr || !orderRow) {
      setSaving(false);
      return toast.error(oErr?.message ?? "Gagal simpan order");
    }

    // 3. insert items
    const rows = cart.items.map((i) => ({
      order_id: orderRow.id,
      menu_item_id: i.menu_item_id,
      name: i.name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      subtotal: i.unit_price * i.quantity,
    }));
    const { error: iErr } = await supabase.from("order_items").insert(rows);
    if (iErr) {
      setSaving(false);
      return toast.error(iErr.message);
    }

    setDone({
      orderNo,
      date: new Date(orderRow.created_at),
      amountTendered: tenderedNum,
      changeDue: change,
    });
    setSaving(false);
    toast.success(`Order #${orderNo} tersimpan`);
  }

  function handlePrint() {
    if (printRef.current) {
      printRef.current.classList.add("print-area");
      window.print();
      printRef.current.classList.remove("print-area");
    }
  }

  function close() {
    onOpenChange(false);
    if (done) onSuccess();
    setDone(null);
    setTendered("");
    setMethod("cash");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? close() : onOpenChange(o))}>
      <DialogContent className="max-w-md">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle>Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-3xl font-bold">{formatIDR(total)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <PayMethodBtn
                  active={method === "cash"}
                  onClick={() => setMethod("cash")}
                  icon={<Banknote className="h-4 w-4" />}
                  label="Tunai"
                />
                <PayMethodBtn
                  active={method === "qris"}
                  onClick={() => setMethod("qris")}
                  icon={<QrCode className="h-4 w-4" />}
                  label="QRIS"
                />
              </div>

              {method === "cash" ? (
                <div className="space-y-2">
                  <Label htmlFor="tendered">Uang diterima</Label>
                  <Input
                    id="tendered"
                    type="number"
                    inputMode="numeric"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={String(total)}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[total, 50000, 100000, 200000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setTendered(String(amt))}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {formatIDR(amt)}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Kembalian</span>
                    <span className="font-semibold">{formatIDR(change)}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Tunjukkan QRIS ke pelanggan, lalu konfirmasi pembayaran sukses.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button onClick={checkout} disabled={saving || !cashOk}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Konfirmasi
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </span>
                Order #{done.orderNo} berhasil
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-xs text-muted-foreground">Total dibayar</div>
                <div className="text-2xl font-bold">{formatIDR(done.amountTendered)}</div>
                {method === "cash" && done.changeDue > 0 && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Kembalian: <span className="font-semibold text-foreground">{formatIDR(done.changeDue)}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 hidden">
                <div ref={printRef}>
                  <Receipt
                    shopName={shop.name}
                    outletName={outlet.name}
                    orderNo={done.orderNo}
                    cashierName={cashierName}
                    date={done.date}
                    items={cart.items}
                    subtotal={total}
                    total={total}
                    paymentMethod={method}
                    amountTendered={done.amountTendered}
                    changeDue={done.changeDue}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Cetak struk
              </Button>
              <Button onClick={close}>Selesai</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayMethodBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
