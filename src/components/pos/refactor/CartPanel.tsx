import { ShoppingBag, Trash2, Plus, Minus, StickyNote, Percent, QrCode, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { cartCount, cartTotal, lineUnitPrice } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";

interface CartPanelProps {
  items: CartItem[];
  onUpdateQty: (idx: number, delta: number) => void;
  onRemove: (idx: number) => void;
  onCheckout: () => void;
  onPark: () => void;
  onClear: () => void;
  isParked: boolean;
  label: string;
  serviceCharge?: number;
  tax?: number;
  grandTotal?: number;
}

export function CartPanel({
  items,
  onUpdateQty,
  onRemove,
  onCheckout,
  onPark,
  onClear,
  isParked,
  label,
  serviceCharge = 0,
  tax = 0,
  grandTotal,
}: CartPanelProps) {
  const subtotal = cartTotal(items);
  const total = grandTotal ?? subtotal + serviceCharge + tax;
  const count = cartCount(items);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 font-semibold min-w-0">
          <ShoppingBag className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary shrink-0">
            {count}
          </span>
          {isParked && (
            <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium shrink-0">
              Tersimpan
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={onClear} disabled={items.length === 0}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <ShoppingBag className="mb-2 h-10 w-10 opacity-10" />
            <p className="text-sm">Keranjang kosong</p>
          </div>
        ) : (
          items.map((it, idx) => (
            <div key={idx} className="group relative flex flex-col gap-1 border-b pb-3 last:border-0">
              <div className="flex justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{it.name}</div>
                  {(it.options ?? []).length > 0 && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {(it.options ?? []).map((o) => o.option_name).join(", ")}
                    </div>
                  )}
                  {it.note && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] italic text-muted-foreground">
                      <StickyNote className="h-3 w-3" /> {it.note}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{formatIDR(lineUnitPrice(it) * it.quantity)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatIDR(lineUnitPrice(it))} / item</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => onUpdateQty(idx, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => onUpdateQty(idx, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemove(idx)}
                  aria-label="Hapus item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Summary */}
      <div className="border-t p-4 space-y-3 bg-muted/20">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(total)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t pt-1.5 text-lg">
            <span>Total</span>
            <span className="text-primary">{formatIDR(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-2" onClick={onPark} disabled={items.length === 0}>
            <StickyNote className="h-4 w-4" />
            {isParked ? "Simpan" : "Parkir"}
          </Button>
          <Button className="gap-2" onClick={onCheckout} disabled={items.length === 0}>
            <Banknote className="h-4 w-4" />
            Bayar
          </Button>
        </div>
      </div>
    </div>
  );
}
