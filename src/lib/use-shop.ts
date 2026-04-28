import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export type Shop = { id: string; name: string; slug: string };

export function useCurrentShop() {
  const { user, loading } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loadingShop, setLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("coffee_shops")
        .select("id, name, slug")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      setShop(data ?? null);
      setLoading(false);
    })();
  }, [user, loading]);

  return { shop, loading: loading || loadingShop };
}
