import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2,
  Banknote,
  ShoppingBag,
  Plus,
  X,
  StickyNote,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import type { CartItem } from "@/lib/cart";
import { cartCount, cartTotal, cartItemKey, lineUnitPrice } from "@/lib/cart";
import { computeCharges } from "@/lib/pricing";
import { ModifierPicker } from "@/components/modifier-picker";
import { getActiveShift, openShift, type CashShift } from "@/lib/shift";

import { MenuGrid } from "@/components/pos/refactor/MenuGrid";
import { CartPanel } from "@/components/pos/refactor/CartPanel";
import { PaymentDialog } from "@/components/pos/refactor/PaymentDialog";
import {
  listParkedCarts,
  parkCart as parkCartRemote,
  deleteParkedCart,
  type ParkedCart,
} from "@/lib/parked-carts";

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

type LocalCart = {
  /** Set when cart is bound to a parked_carts row in DB */
  parkedId: string | null;
  label: string;
  items: CartItem[];
};

const MAX_CARTS = 6;

function newCart(label = "Cart 1"): LocalCart {
  return { parkedId: null, label, items: [] };
}

function storageKey(outletId: string) {
  return `kopihub.pos.carts.${outletId}`;
}

function loadFromStorage(outletId: string): { carts: LocalCart[]; activeIdx: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(outletId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.carts) || parsed.carts.length === 0) return null;
    return { carts: parsed.carts, activeIdx: parsed.activeIdx ?? 0 };
  } catch {
    return null;
  }
}

function POSPage() {
  const { user } = useAuth();
  const { shop, outlet, loading: shopLoading } = useCurrentShop();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [carts, setCarts] = useState<LocalCart[]>([newCart()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const hydratedRef = useRef(false);

  const [shift, setShift] = useState<CashShift | null>(null);
  const [openShiftDlg, setOpenShiftDlg] = useState(false);
  const [openingCash, setOpeningCash] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [modPickerItem, setModPickerItem] = useState<MenuItem | null>(null);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  // Park dialog
  const [parkOpen, setParkOpen] = useState(false);
  const [parkLabel, setParkLabel] = useState("");
  const [parkSaving, setParkSaving] = useState(false);

  // Parked carts list (multi-device)
  const [parkedList, setParkedList] = useState<ParkedCart[]>([]);
  const [parkedListOpen, setParkedListOpen] = useState(false);

  const cart = carts[activeIdx] ?? carts[0];

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

  // Hydrate carts from localStorage per outlet
  useEffect(() => {
    if (!outlet) return;
    hydratedRef.current = false;
    const persisted = loadFromStorage(outlet.id);
    if (persisted) {
      setCarts(persisted.carts);
      setActiveIdx(Math.min(persisted.activeIdx, persisted.carts.length - 1));
    } else {
      setCarts([newCart()]);
      setActiveIdx(0);
    }
    // Mark hydrated on next tick to avoid overwriting with default state
    queueMicrotask(() => {
      hydratedRef.current = true;
    });
  }, [outlet?.id]);

  // Persist carts to localStorage
  useEffect(() => {
    if (!outlet || !hydratedRef.current) return;
    try {
      localStorage.setItem(storageKey(outlet.id), JSON.stringify({ carts, activeIdx }));
    } catch {
      // quota / private mode: ignore
    }
  }, [carts, activeIdx, outlet?.id]);

  // Shift handling
  useEffect(() => {
    if (!outlet) return;
    getActiveShift(outlet.id).then(setShift);
  }, [outlet?.id]);

  // Load parked carts list + realtime subscription
  const refreshParked = async () => {
    if (!outlet) return;
    try {
      const data = await listParkedCarts(outlet.id);
      setParkedList(data);
    } catch (e: any) {
      console.error("Failed to load parked carts:", e.message);
    }
  };

  useEffect(() => {
    if (!outlet) return;
    refreshParked();
    const channel = supabase
      .channel(`parked_carts:${outlet.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parked_carts", filter: `outlet_id=eq.${outlet.id}` },
        () => refreshParked(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [outlet?.id]);

  const handleOpenShift = async () => {
    if (!outlet) return;
    try {
      await openShift(outlet.id, Number(openingCash || 0));
      toast.success("Shift dibuka");
      setOpenShiftDlg(false);
      const s = await getActiveShift(outlet.id);
      setShift(s);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Cart Actions
  const updateCart = (updater: (c: LocalCart) => LocalCart) => {
    setCarts((prev) => {
      const next = [...prev];
      next[activeIdx] = updater(next[activeIdx]);
      return next;
    });
  };

  const addToCart = (it: MenuItem, options: any[] = []) => {
    updateCart((c) => {
      const items = [...c.items];
      const key = cartItemKey({ menu_item_id: it.id, options });
      const existing = items.findIndex(
        (x) => cartItemKey({ menu_item_id: x.menu_item_id, options: x.options }) === key,
      );

      if (existing >= 0) {
        items[existing].quantity += 1;
      } else {
        items.push({
          menu_item_id: it.id,
          name: it.name,
          unit_price: it.price,
          quantity: 1,
          options,
          note: "",
        });
      }
      return { ...c, items };
    });
  };

  const addCartTab = () => {
    if (carts.length >= MAX_CARTS) {
      toast.error(`Maksimal ${MAX_CARTS} tab cart aktif`);
      return;
    }
    setCarts((prev) => [...prev, newCart(`Cart ${prev.length + 1}`)]);
    setActiveIdx(carts.length);
  };

  const closeCartTab = (idx: number) => {
    if (carts.length === 1) {
      // Reset only
      setCarts([newCart()]);
      setActiveIdx(0);
      return;
    }
    const target = carts[idx];
    if (target.items.length > 0 && !target.parkedId) {
      const ok = window.confirm(
        `Cart "${target.label}" memiliki ${cartCount(target.items)} item dan belum diparkir. Tutup tetap?`,
      );
      if (!ok) return;
    }
    setCarts((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => (prev >= idx ? Math.max(0, prev - 1) : prev));
  };

  const handleParkClick = () => {
    if (cart.items.length === 0) return;
    setParkLabel(cart.label || `Cart ${activeIdx + 1}`);
    setParkOpen(true);
  };

  const submitPark = async () => {
    if (!shop || !outlet) return;
    if (!parkLabel.trim()) {
      toast.error("Label tidak boleh kosong");
      return;
    }
    setParkSaving(true);
    try {
      const saved = await parkCartRemote({
        id: cart.parkedId,
        shop_id: shop.id,
        outlet_id: outlet.id,
        label: parkLabel.trim(),
        items: cart.items,
        created_by: user?.id ?? null,
      });
      // Bind current cart tab to saved row, then clear local working cart
      setCarts((prev) => {
        const next = [...prev];
        // Remove the current cart tab; parked is now in DB list
        next.splice(activeIdx, 1);
        if (next.length === 0) next.push(newCart());
        return next;
      });
      setActiveIdx(0);
      toast.success(`Cart diparkir: ${saved.label}`);
      setParkOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal memarkir cart");
    } finally {
      setParkSaving(false);
    }
  };

  const restoreParked = (p: ParkedCart) => {
    if (carts.length >= MAX_CARTS) {
      toast.error(`Maksimal ${MAX_CARTS} tab cart aktif. Tutup salah satu dulu.`);
      return;
    }
    // Don't allow restoring the same parked cart twice
    if (carts.some((c) => c.parkedId === p.id)) {
      const idx = carts.findIndex((c) => c.parkedId === p.id);
      setActiveIdx(idx);
      setParkedListOpen(false);
      toast.info("Cart ini sudah terbuka di tab lain");
      return;
    }
    const restored: LocalCart = {
      parkedId: p.id,
      label: p.label,
      items: (p.items ?? []) as CartItem[],
    };
    setCarts((prev) => [...prev, restored]);
    setActiveIdx(carts.length);
    setParkedListOpen(false);
    toast.success(`Memuat cart: ${p.label}`);
  };

  const removeParked = async (p: ParkedCart) => {
    if (!window.confirm(`Hapus parked cart "${p.label}"?`)) return;
    try {
      await deleteParkedCart(p.id);
      toast.success("Parked cart dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCheckout = async (method: string, _amount: number) => {
    if (!outlet || !user) return;

    try {
      const { data: order, error: orderErr } = await (supabase as any)
        .from("orders")
        .insert({
          outlet_id: outlet.id,
          shop_id: shop!.id,
          total: cartTotal(cart.items),
          subtotal: cartTotal(cart.items),
          status: "completed",
          payment_method: method,
          payment_status: "paid",
          cashier_id: user.id,
          channel: "pos",
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const orderItems = cart.items.map((it) => ({
        order_id: order.id,
        menu_item_id: it.menu_item_id,
        name: it.name,
        quantity: it.quantity,
        unit_price: lineUnitPrice(it),
        subtotal: lineUnitPrice(it) * it.quantity,
        note: it.note ?? null,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      // If cart was bound to a parked entry, remove it from DB
      if (cart.parkedId) {
        try {
          await deleteParkedCart(cart.parkedId);
        } catch {
          /* ignore */
        }
      }

      toast.success("Pesanan berhasil");
      setCheckoutOpen(false);
      setCartSheetOpen(false);
      // Reset current tab
      updateCart(() => newCart(cart.label));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (shopLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (!shift && !openShiftDlg) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-muted/30 p-4 text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-6">
          <Banknote className="h-12 w-12 text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Shift Belum Dibuka</h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          Anda harus membuka shift kasir terlebih dahulu sebelum dapat melakukan transaksi di POS.
        </p>
        <Button size="lg" onClick={() => setOpenShiftDlg(true)}>
          Buka Shift Sekarang
        </Button>
      </div>
    );
  }

  const cartPanel = (
    <CartPanel
      items={cart.items}
      label={cart.label}
      isParked={!!cart.parkedId}
      onUpdateQty={(idx, delta) => {
        updateCart((c) => {
          const items = [...c.items];
          items[idx].quantity = Math.max(1, items[idx].quantity + delta);
          return { ...c, items };
        });
      }}
      onRemove={(idx) => {
        updateCart((c) => ({ ...c, items: c.items.filter((_, i) => i !== idx) }));
      }}
      onClear={() => updateCart((c) => ({ ...c, items: [] }))}
      onPark={handleParkClick}
      onCheckout={() => setCheckoutOpen(true)}
    />
  );

  const totalItems = cartCount(cart.items);

  return (
    <div className="flex h-[calc(100vh-3rem)] lg:h-screen overflow-hidden flex-col md:flex-row">
      {/* Multi-cart Tabs Bar */}
      <div className="md:hidden flex items-center gap-1 border-b bg-background px-2 py-1.5 overflow-x-auto shrink-0">
        <CartTabs
          carts={carts}
          activeIdx={activeIdx}
          onSelect={setActiveIdx}
          onClose={closeCartTab}
          onAdd={addCartTab}
          onOpenParked={() => setParkedListOpen(true)}
          parkedCount={parkedList.length}
        />
      </div>

      {/* Left: Menu Grid */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="hidden md:flex items-center gap-1 border-b bg-background px-2 py-1.5 overflow-x-auto shrink-0">
          <CartTabs
            carts={carts}
            activeIdx={activeIdx}
            onSelect={setActiveIdx}
            onClose={closeCartTab}
            onAdd={addCartTab}
            onOpenParked={() => setParkedListOpen(true)}
            parkedCount={parkedList.length}
          />
        </div>
        <div className="flex-1 min-h-0">
          <MenuGrid
            categories={categories}
            items={items}
            onItemClick={(it) => setModPickerItem(it)}
            loading={loading}
          />
        </div>
      </div>

      {/* Right: Cart Panel (desktop) */}
      <aside className="w-80 border-l bg-background shrink-0 hidden md:block">
        {cartPanel}
      </aside>

      {/* Mobile cart Sheet */}
      <div className="md:hidden">
        <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg gap-2 h-14 px-5"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="font-semibold">{totalItems}</span>
              {totalItems > 0 && (
                <span className="text-xs opacity-90">{formatIDR(cartTotal(cart.items))}</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Keranjang</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0">{cartPanel}</div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Modals */}
      <ModifierPicker
        open={!!modPickerItem}
        onClose={() => setModPickerItem(null)}
        menuItemId={modPickerItem?.id ?? ""}
        menuItemName={modPickerItem?.name ?? ""}
        shopId={shop?.id ?? ""}
        onConfirm={(options) => {
          if (modPickerItem) addToCart(modPickerItem, options);
          setModPickerItem(null);
        }}
      />

      <PaymentDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={cartTotal(cart.items)}
        onConfirm={handleCheckout}
      />

      {/* Park Dialog */}
      <Dialog open={parkOpen} onOpenChange={setParkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parkir Cart</DialogTitle>
            <DialogDescription>
              Cart akan disimpan di server dan bisa diakses dari device lain di outlet ini.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="park-label">Label / Nama Meja</Label>
              <Input
                id="park-label"
                placeholder="Mis. Meja 5 / Pak Budi"
                value={parkLabel}
                onChange={(e) => setParkLabel(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item</span>
                <span>{cartCount(cart.items)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Total</span>
                <span>{formatIDR(cartTotal(cart.items))}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParkOpen(false)} disabled={parkSaving}>
              Batal
            </Button>
            <Button onClick={submitPark} disabled={parkSaving}>
              {parkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parked List Dialog */}
      <Dialog open={parkedListOpen} onOpenChange={setParkedListOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cart Tersimpan ({parkedList.length})</DialogTitle>
            <DialogDescription>
              Cart yang diparkir oleh kasir manapun di outlet ini.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
            {parkedList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Belum ada cart yang diparkir.
              </div>
            ) : (
              <ul className="divide-y">
                {parkedList.map((p) => {
                  const total = cartTotal((p.items ?? []) as CartItem[]);
                  const count = cartCount((p.items ?? []) as CartItem[]);
                  return (
                    <li key={p.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {count} item · {formatIDR(total)} ·{" "}
                          {new Date(p.created_at).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => restoreParked(p)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Buka
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8"
                        onClick={() => removeParked(p)}
                        aria-label="Hapus parked cart"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openShiftDlg} onOpenChange={setOpenShiftDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buka Shift Kasir</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Modal Awal (Tunai)</Label>
              <Input
                type="number"
                placeholder="0"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenShiftDlg(false)}>
              Batal
            </Button>
            <Button onClick={handleOpenShift}>Buka Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ CartTabs sub-component ============
function CartTabs({
  carts,
  activeIdx,
  onSelect,
  onClose,
  onAdd,
  onOpenParked,
  parkedCount,
}: {
  carts: LocalCart[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onClose: (idx: number) => void;
  onAdd: () => void;
  onOpenParked: () => void;
  parkedCount: number;
}) {
  return (
    <>
      {carts.map((c, idx) => {
        const active = idx === activeIdx;
        const count = cartCount(c.items);
        return (
          <div
            key={idx}
            className={`group flex items-center gap-1 rounded-md border px-2 h-8 text-xs whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border bg-background hover:bg-muted/50"
            }`}
            onClick={() => onSelect(idx)}
          >
            <span className="truncate max-w-[100px]">{c.label}</span>
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  active ? "bg-primary/20" : "bg-muted"
                }`}
              >
                {count}
              </span>
            )}
            {c.parkedId && (
              <StickyNote className="h-3 w-3 text-amber-500" aria-label="Tersimpan" />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(idx);
              }}
              className="ml-0.5 -mr-0.5 rounded hover:bg-muted-foreground/10 p-0.5"
              aria-label="Tutup tab"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onAdd}
        aria-label="Tab baru"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-5 w-px bg-border shrink-0" />
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={onOpenParked}>
        <StickyNote className="h-3.5 w-3.5" />
        Tersimpan
        {parkedCount > 0 && (
          <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 text-[10px] font-medium">
            {parkedCount}
          </span>
        )}
      </Button>
    </>
  );
}
