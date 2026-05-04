import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";

export type PlanInfo = {
  plan: "free" | "pro";
  expiresAt: Date | null;
  isPro: boolean;
  loading: boolean;
};

export function usePlan(): PlanInfo {
  const { shop, loading: shopLoading } = useCurrentShop();
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shopLoading) return;
    if (!shop) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("coffee_shops")
        .select("plan, plan_expires_at")
        .eq("id", shop.id)
        .maybeSingle();
      const exp = data?.plan_expires_at ? new Date(data.plan_expires_at) : null;
      const active = data?.plan === "pro" && (!exp || exp.getTime() > Date.now());
      setPlan(active ? "pro" : "free");
      setExpiresAt(exp);
      setLoading(false);
    })();
  }, [shop, shopLoading]);

  return { plan, expiresAt, isPro: plan === "pro", loading };
}

export function useIsSuperAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", u.user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      setIsAdmin(!!data);
      setLoading(false);
    })();
  }, []);
  return { isAdmin, loading };
}
