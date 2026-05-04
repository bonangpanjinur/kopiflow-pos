// Customer-side cart (localStorage), per-shop scoped
import type { SelectedOption } from "@/lib/cart";

export type CustomerCartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  image_url: string | null;
  note?: string;
  options?: SelectedOption[];
};

const KEY = (slug: string) => `kopihub.cart.${slug}`;

export function readCart(slug: string): CustomerCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(slug));
    return raw ? (JSON.parse(raw) as CustomerCartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(slug: string, items: CustomerCartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(slug), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("kopihub-cart-change", { detail: { slug } }));
}

export function clearCart(slug: string) {
  writeCart(slug, []);
}

function itemKey(item: { menu_item_id: string; options?: SelectedOption[] }) {
  const optKey = (item.options ?? [])
    .map((o) => o.option_id)
    .sort()
    .join(",");
  return `${item.menu_item_id}::${optKey}`;
}

export function addToCart(slug: string, item: Omit<CustomerCartItem, "qty">, qty = 1) {
  const items = readCart(slug);
  const key = itemKey(item);
  const idx = items.findIndex((i) => itemKey(i) === key);
  if (idx >= 0) items[idx].qty += qty;
  else items.push({ ...item, qty });
  writeCart(slug, items);
}

export function setQty(slug: string, menu_item_id: string, qty: number) {
  const items = readCart(slug).map((i) =>
    i.menu_item_id === menu_item_id ? { ...i, qty } : i,
  );
  writeCart(slug, items.filter((i) => i.qty > 0));
}

export function removeItem(slug: string, menu_item_id: string) {
  writeCart(slug, readCart(slug).filter((i) => i.menu_item_id !== menu_item_id));
}

/** Effective price per unit = base + option adjustments */
export function itemUnitPrice(item: CustomerCartItem) {
  const adj = (item.options ?? []).reduce((s, o) => s + o.price_adjustment, 0);
  return item.price + adj;
}

export function cartTotal(items: CustomerCartItem[]) {
  return items.reduce((s, i) => s + itemUnitPrice(i) * i.qty, 0);
}

export function cartCount(items: CustomerCartItem[]) {
  return items.reduce((s, i) => s + i.qty, 0);
}
