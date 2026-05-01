import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export type StaffInfo = {
  isOwner: boolean;
  isStaff: boolean;
  role: string | null;
  shopId: string | null;
  allowedModules: string[] | null; // null = all allowed
  loading: boolean;
};

const MODULE_MAP: Record<string, string[]> = {
  manager: [], // all
  cashier: ["pos", "orders", "shifts"],
  barista: ["orders", "online-orders"],
};

export function useStaffRole(): StaffInfo {
  const { user, loading } = useAuth();
  const [info, setInfo] = useState<StaffInfo>({
    isOwner: false,
    isStaff: false,
    role: null,
    shopId: null,
    allowedModules: null,
    loading: true,
  });

  useEffect(() => {
    if (loading || !user) {
      setInfo((p) => ({ ...p, loading }));
      return;
    }
    (async () => {
      // Check if user owns a shop
      const { data: shop } = await supabase
        .from("coffee_shops")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shop) {
        setInfo({ isOwner: true, isStaff: false, role: "owner", shopId: shop.id, allowedModules: null, loading: false });
        return;
      }

      // Check staff permissions
      const { data: perm } = await supabase
        .from("staff_permissions")
        .select("shop_id, role, allowed_modules")
        .eq("user_id", user.id)
        .maybeSingle();

      if (perm) {
        const modules = perm.allowed_modules ?? MODULE_MAP[perm.role] ?? null;
        setInfo({ isOwner: false, isStaff: true, role: perm.role, shopId: perm.shop_id, allowedModules: modules, loading: false });
        return;
      }

      setInfo({ isOwner: false, isStaff: false, role: null, shopId: null, allowedModules: null, loading: false });
    })();
  }, [user, loading]);

  return info;
}

/** Check if a nav path is allowed for the current user */
export function isModuleAllowed(path: string, allowedModules: string[] | null): boolean {
  if (!allowedModules) return true; // null = all allowed
  // Extract module from path like /app/pos → pos
  const segment = path.replace(/^\/app\/?/, "").split("/")[0];
  if (!segment) return true; // dashboard always allowed
  return allowedModules.includes(segment);
}
