import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  readCart,
  setQty,
  removeItem,
  cartTotal,
  itemUnitPrice,
  type CustomerCartItem,
} from "@/lib/customer-cart";
import { formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/s/$slug/cart")({
  component: CartPage,
});

function CartPage() {
  const { slug } = useParams({ from: "/s/$slug/cart" });
  const navigate = useNavigate();
  const [items, setItems] = useState<CustomerCartItem[]>([]);

  useEffect(() => {
    setItems(readCart(slug));
    const handler = () => setItems(readCart(slug));
    window.addEventListener("kopihub-cart-change", handler);
    return () => window.removeEventListener("kopihub-cart-change", handler);
  }, [slug]);

  const total = cartTotal(items);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShoppingBag className="mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Keranjang kosong</p>
        <Link to="/s/$slug" params={{ slug }} className="mt-4">
          <Button>Lihat menu</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-lg font-semibold">Keranjang</h1>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.menu_item_id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {i.image_url ? (
                <img src={i.image_url} alt={i.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{i.name}</p>
                  {i.options && i.options.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {i.options.map((o) => o.option_name).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatIDR(itemUnitPrice(i))}</p>
                  {i.note && <p className="mt-0.5 text-xs italic text-muted-foreground">"{i.note}"</p>}
                </div>
                <button
                  onClick={() => removeItem(slug, i.menu_item_id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center rounded-md border border-border">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(slug, i.menu_item_id, i.qty - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-xs font-semibold">{i.qty}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQty(slug, i.menu_item_id, i.qty + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <span className="text-sm font-semibold">{formatIDR(itemUnitPrice(i) * i.qty)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-base font-semibold">{formatIDR(total)}</p>
          </div>
          <Button onClick={() => navigate({ to: "/s/$slug/checkout", params: { slug } })}>
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
