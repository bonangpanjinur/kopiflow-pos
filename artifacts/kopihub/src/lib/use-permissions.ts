import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentShop } from "@/lib/use-shop";

export type AppRole = "owner" | "manager" | "cashier" | "kitchen" | "waiter";

export type PermissionModule = 
  | "pos.view"
  | "pos.order"
  | "pos.void"
  | "pos.refund"
  | "pos.discount"
  | "inventory.view"
  | "inventory.manage"
  | "reports.view"
  | "settings.general"
  | "settings.staff"
  | "kds.view"
  | "kds.manage"
  | "tables.manage";

export function usePermissions() {
  const { user } = useAuth();
  const { shop } = useCurrentShop();
  const [role, setRole] = useState<AppRole | null>(null);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !shop) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setLoading(true);
      
      // 1. Get user role in this shop
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("shop_id", shop.id)
        .maybeSingle();

      const userRole = (roleData?.role as AppRole) || (shop.owner_id === user.id ? "owner" : null);
      setRole(userRole);

      // 2. Get granular permissions
      if (userRole === "owner") {
        // Owner has all permissions
        setAllowedModules(["*"]);
      } else {
        const { data: permData } = await supabase
          .from("staff_permissions")
          .select("allowed_modules")
          .eq("user_id", user.id)
          .eq("shop_id", shop.id)
          .maybeSingle();
        
        setAllowedModules(permData?.allowed_modules || []);
      }
      
      setLoading(false);
    };

    fetchPermissions();
  }, [user, shop]);

  const can = (module: PermissionModule): boolean => {
    if (role === "owner") return true;
    if (allowedModules.includes("*")) return true;
    
    // Default permissions based on role if no granular permissions set
    if (allowedModules.length === 0) {
      switch (role) {
        case "manager":
          return !module.startsWith("settings.general");
        case "cashier":
          return module.startsWith("pos.") && !["pos.void", "pos.refund"].includes(module);
        case "kitchen":
          return module.startsWith("kds.");
        case "waiter":
          return module === "pos.view" || module === "pos.order" || module === "kds.view";
        default:
          return false;
      }
    }

    return allowedModules.includes(module);
  };

  return { role, allowedModules, can, loading };
}
