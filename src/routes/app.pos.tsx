import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
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
import { Loader2, Plus, Minus, Trash2, Search, ShoppingBag, X, Save, Banknote, QrCode, Printer, Check, ImageIcon, StickyNote, Percent } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import type { CartItem } from "@/lib/cart";
import { cartCount, cartTotal, cartItemKey, lineUnitPrice } from "@/lib/cart";
import { ModifierPicker } from "@/components/modifier-picker";
import { getActiveShift, openShift, type CashShift } from "@/lib/shift";

// Refactored Components
import { MenuGrid } from "@/components/pos/refactor/MenuGrid";
import { CartPanel } from "@/components/pos/refactor/CartPanel";
import { PaymentDialog } from "@/components/pos/refactor/PaymentDialog";

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

function POSPage() {
  const { user } = useAuth();
  const { shop, outlet, loading: shopLoading } = useCurrentShop();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [carts, setCarts] = useState<LocalCart[]>([newCart()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [shift, setShift] = useState<CashShift | null>(null);
  const [openShiftDlg, setOpenShiftDlg] = useState(false);
  const [openingCash, setOpeningCash] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [modPickerItem, setModPickerItem] = useState<MenuItem | null>(null);

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

  // Shift handling
  useEffect(() => {
    if (!outlet) return;
    getActiveShift(outlet.id).then(setShift);
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
    toast.success(`${it.name} ditambahkan`);
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

      toast.success("Pesanan berhasil");
      setCheckoutOpen(false);
      updateCart((c) => ({ ...c, items: [] }));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (shopLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

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
        <Button size="lg" onClick={() => setOpenShiftDlg(true)}>Buka Shift Sekarang</Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] lg:h-screen overflow-hidden">
      {/* Left: Menu Grid */}
      <MenuGrid
        categories={categories}
        items={items}
        onItemClick={(it) => setModPickerItem(it)}
        loading={loading}
      />

      {/* Right: Cart Panel */}
      <aside className="w-80 border-l bg-background shrink-0 hidden md:block">
        <CartPanel
          items={cart.items}
          label={cart.label}
          isParked={!!cart.id}
          onUpdateQty={(idx, delta) => {
            updateCart(c => {
              const items = [...c.items];
              items[idx].quantity = Math.max(1, items[idx].quantity + delta);
              return { ...c, items };
            });
          }}
          onRemove={(idx) => {
            updateCart(c => ({ ...c, items: c.items.filter((_, i) => i !== idx) }));
          }}
          onClear={() => updateCart(c => ({ ...c, items: [] }))}
          onPark={() => toast.info("Fitur parkir akan segera hadir")}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </aside>

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

      <Dialog open={openShiftDlg} onOpenChange={setOpenShiftDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buka Shift Kasir</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setOpenShiftDlg(false)}>Batal</Button>
            <Button onClick={handleOpenShift}>Buka Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
