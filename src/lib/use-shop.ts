import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export type Shop = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  tax_percent: number;
  service_charge_percent: number;
  tax_inclusive: boolean;
};
export type Outlet = { id: string; name: string };

export function useCurrentShop() {
  const { user, loading } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [loadingShop, setLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from("coffee_shops")
        .select("id, name, slug, logo_url, address, phone")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      setShop(s ?? null);
      if (s) {
        const { data: o } = await supabase
          .from("outlets")
          .select("id, name")
          .eq("shop_id", s.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        setOutlet(o ?? null);
      }
      setLoading(false);
    })();
  }, [user, loading]);

  return { shop, outlet, loading: loading || loadingShop };
}
