import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("owner_notifications")
      .select("id, shop_id, type, title, body, link, severity, read_at, dismissed_at, created_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const markNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["read", "dismiss"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch =
      data.action === "dismiss"
        ? { dismissed_at: new Date().toISOString(), read_at: new Date().toISOString() }
        : { read_at: new Date().toISOString() };
    const { error } = await supabase.from("owner_notifications").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dismissAllNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("owner_notifications")
      .update({ dismissed_at: new Date().toISOString(), read_at: new Date().toISOString() })
      .is("dismissed_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
