export type CartItem = {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  note?: string;
};

export function cartTotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((s, i) => s + i.quantity, 0);
}
