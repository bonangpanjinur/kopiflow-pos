import type { ReactNode } from "react";

export type StorefrontShop = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  open_hours: unknown;
};

export type StorefrontItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_available: boolean;
};

export type StorefrontCategory = { id: string; name: string };

export type StorefrontStatus = { open: boolean; label: string } | null;

export type ThemeHomeProps = {
  slug: string;
  shop: StorefrontShop;
  cats: StorefrontCategory[];
  items: StorefrontItem[];
  filtered: StorefrontItem[];
  activeCat: string;
  setActiveCat: (id: string) => void;
  q: string;
  setQ: (v: string) => void;
  status: StorefrontStatus;
  onAdd: (item: StorefrontItem) => void;
  renderItemLink: (item: StorefrontItem, children: ReactNode) => ReactNode;
};