import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Outlet = { id: string; name: string; address: string | null; is_active: boolean };

type OutletCtx = {
  outlets: Outlet[];
  current: Outlet | null;
  setCurrent: (outlet: Outlet) => void;
  loading: boolean;
};

const OutletContext = createContext<OutletCtx>({ outlets: [], current: null, setCurrent: () => {}, loading: true });

export function useOutletContext() { return useContext(OutletContext); }

const STORAGE_KEY = "kopihub_outlet_id";

export function OutletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [current, setCurrentState] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    // Owner sees all outlets for their shop
    const { data: shop } = await supabase.from("coffee_shops").select("id").eq("owner_id", user.id).maybeSingle();
    if (!shop) { setLoading(false); return; }
    const { data } = await supabase.from("outlets").select("id, name, address, is_active").eq("shop_id", shop.id).order("name");
    const list = (data ?? []) as Outlet[];
    setOutlets(list);

    // Restore saved selection
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const match = list.find((o) => o.id === saved);
    setCurrentState(match ?? list[0] ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const setCurrent = (outlet: Outlet) => {
    setCurrentState(outlet);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, outlet.id);
  };

  return (
    <OutletContext.Provider value={{ outlets, current, setCurrent, loading }}>
      {children}
    </OutletContext.Provider>
  );
}
