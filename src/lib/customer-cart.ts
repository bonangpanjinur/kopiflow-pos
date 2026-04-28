// Customer-side cart (localStorage), per-shop scoped
export type CustomerCartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  image_url: string | null;
  note?: string;
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

export function addToCart(slug: string, item: Omit<CustomerCartItem, "qty">, qty = 1) {
  const items = readCart(slug);
  const idx = items.findIndex((i) => i.menu_item_id === item.menu_item_id);
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

export function cartTotal(items: CustomerCartItem[]) {
  return items.reduce((s, i) => s + i.price * i.qty, 0);
}

export function cartCount(items: CustomerCartItem[]) {
  return items.reduce((s, i) => s + i.qty, 0);
}
