export type SelectedOption = {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_adjustment: number;
};

export type CartItem = {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  note?: string;
  options?: SelectedOption[];
};

/** Effective price per unit = base price + sum of option adjustments */
export function lineUnitPrice(item: CartItem) {
  const adj = (item.options ?? []).reduce((s, o) => s + o.price_adjustment, 0);
  return item.unit_price + adj;
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((s, i) => s + lineUnitPrice(i) * i.quantity, 0);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((s, i) => s + i.quantity, 0);
}

/** Generate a unique key for cart deduplication (item + selected options) */
export function cartItemKey(item: { menu_item_id: string; options?: SelectedOption[] }) {
  const optKey = (item.options ?? [])
    .map((o) => o.option_id)
    .sort()
    .join(",");
  return `${item.menu_item_id}::${optKey}`;
}
