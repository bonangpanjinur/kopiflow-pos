import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("not_authorized");
}

export const getAdminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_dashboard_stats");
    if (error) throw new Error(error.message);
    return data as Record<string, number>;
  });

export const getShopDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: detail, error } = await supabaseAdmin.rpc("admin_shop_detail", {
      _shop_id: data.shopId,
    });
    if (error) throw new Error(error.message);

    // Fetch owner email via admin auth API
    let ownerEmail: string | null = null;
    let ownerLastSignIn: string | null = null;
    const ownerId = (detail as { owner?: { id?: string } })?.owner?.id;
    if (ownerId) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(ownerId);
        ownerEmail = u?.user?.email ?? null;
        ownerLastSignIn = u?.user?.last_sign_in_at ?? null;
      } catch {
        // best-effort
      }
    }

    return { ...(detail as object), ownerEmail, ownerLastSignIn };
  });

export const setShopPlanManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        plan: z.enum(["free", "pro"]),
        expiresAt: z.string().datetime().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("admin_set_shop_plan", {
      _shop_id: data.shopId,
      _plan: data.plan,
      _expires_at: data.expiresAt as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const suspendShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shopId: z.string().uuid(),
        reason: z.string().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("admin_suspend_shop", {
      _shop_id: data.shopId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsuspendShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("admin_unsuspend_shop", {
      _shop_id: data.shopId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendOwnerPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shopId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: shop } = await supabaseAdmin
      .from("coffee_shops")
      .select("owner_id")
      .eq("id", data.shopId)
      .maybeSingle();
    if (!shop) throw new Error("shop_not_found");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(shop.owner_id);
    const email = u?.user?.email;
    if (!email) throw new Error("owner_email_missing");

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("system_audit").insert({
      event_type: "owner_password_reset_sent",
      shop_id: data.shopId,
      actor_id: context.userId,
      payload: { email },
    });
    return { ok: true, email };
  });
