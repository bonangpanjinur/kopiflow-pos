import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Daftar tabel yang termasuk dalam backup penuh per-toko.
 * Setiap entri: nama tabel + kolom kunci yang menyaring per shop_id.
 * Beberapa tabel terkait via order/po, kita ambil terpisah.
 */
const SHOP_TABLES: Array<{ table: string; shopColumn: string | null; via?: { table: string; key: string; shopColumn: string } }> = [
  { table: "businesses", shopColumn: "id" },
  { table: "outlets", shopColumn: "shop_id" },
  { table: "categories", shopColumn: "shop_id" },
  { table: "menu_items", shopColumn: "shop_id" },
  { table: "ingredients", shopColumn: "shop_id" },
  { table: "recipes", shopColumn: "shop_id" },
  { table: "suppliers", shopColumn: "shop_id" },
  { table: "purchase_orders", shopColumn: "shop_id" },
  { table: "stock_movements", shopColumn: "shop_id" },
  { table: "promos", shopColumn: "shop_id" },
  { table: "promo_redemptions", shopColumn: "shop_id" },
  { table: "loyalty_settings", shopColumn: "shop_id" },
  { table: "loyalty_points", shopColumn: "shop_id" },
  { table: "loyalty_ledger", shopColumn: "shop_id" },
  { table: "delivery_settings", shopColumn: "shop_id" },
  { table: "delivery_zones", shopColumn: "shop_id" },
  { table: "couriers", shopColumn: "shop_id" },
  { table: "orders", shopColumn: "shop_id" },
  { table: "cash_shifts", shopColumn: "shop_id" },
  { table: "attendances", shopColumn: "shop_id" },
  { table: "user_roles", shopColumn: "shop_id" },
  { table: "owner_notifications", shopColumn: "shop_id" },
];

async function ensureOwner(shopId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("businesses")
    .select("id, owner_id, slug, name")
    .eq("id", shopId)
    .maybeSingle();
  if (!data) throw new Error("shop_not_found");
  if (data.owner_id !== userId) throw new Error("not_authorized");
  return data;
}

export const requestShopBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ shopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const shop = await ensureOwner(data.shopId, userId);

    // Rate limit: max 1 backup per 24h per shop
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("shop_backups")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", data.shopId)
      .gte("created_at", since);
    if ((count ?? 0) >= 1) {
      throw new Error("rate_limited: hanya 1 backup per 24 jam");
    }

    const includes: string[] = [];
    const dump: Record<string, unknown[]> = {};
    for (const t of SHOP_TABLES) {
      if (!t.shopColumn) continue;
      const { data: rows, error } = await supabaseAdmin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(t.table as any)
        .select("*")
        .eq(t.shopColumn, data.shopId)
        .limit(50000);
      if (error) continue;
      dump[t.table] = (rows ?? []) as unknown[];
      includes.push(t.table);
    }

    // Order items: filter via orders ids
    const orderIds = (dump.orders as Array<{ id: string }> | undefined)?.map((o) => o.id) ?? [];
    if (orderIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      dump.order_items = items ?? [];
      includes.push("order_items");
    }
    // Purchase order items
    const poIds = (dump.purchase_orders as Array<{ id: string }> | undefined)?.map((p) => p.id) ?? [];
    if (poIds.length > 0) {
      const { data: poi } = await supabaseAdmin
        .from("purchase_order_items")
        .select("*")
        .in("po_id", poIds);
      dump.purchase_order_items = poi ?? [];
      includes.push("purchase_order_items");
    }

    const manifest = {
      shop_id: data.shopId,
      shop_slug: shop.slug,
      shop_name: shop.name,
      generated_at: new Date().toISOString(),
      generated_by: userId,
      tables: includes,
      record_counts: Object.fromEntries(includes.map((k) => [k, (dump[k] ?? []).length])),
      version: 1,
    };

    const payload = JSON.stringify({ manifest, data: dump }, null, 2);
    const fileName = `backup-${shop.slug}-${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.json`;
    const filePath = `${data.shopId}/${fileName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("shop-backups")
      .upload(filePath, new Blob([payload], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

    const { data: backup, error: insErr } = await supabaseAdmin
      .from("shop_backups")
      .insert({
        shop_id: data.shopId,
        requested_by: userId,
        status: "completed",
        file_path: filePath,
        size_bytes: payload.length,
        includes: includes,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { ok: true, backupId: backup.id, sizeBytes: payload.length, tableCount: includes.length };
  });

export const listShopBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: shop } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!shop) return [];
    const { data } = await supabase
      .from("shop_backups")
      .select("id, status, file_path, size_bytes, includes, error_message, created_at, completed_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ backupId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: backup } = await supabaseAdmin
      .from("shop_backups")
      .select("file_path, shop_id")
      .eq("id", data.backupId)
      .maybeSingle();
    if (!backup) throw new Error("backup_not_found");
    await ensureOwner(backup.shop_id, userId);
    if (!backup.file_path) throw new Error("no_file");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("shop-backups")
      .createSignedUrl(backup.file_path, 60 * 60); // 1 hour
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ backupId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: backup } = await supabaseAdmin
      .from("shop_backups")
      .select("file_path, shop_id")
      .eq("id", data.backupId)
      .maybeSingle();
    if (!backup) throw new Error("backup_not_found");
    await ensureOwner(backup.shop_id, userId);
    if (backup.file_path) {
      await supabaseAdmin.storage.from("shop-backups").remove([backup.file_path]);
    }
    await supabaseAdmin.from("shop_backups").delete().eq("id", data.backupId);
    return { ok: true };
  });

export const upsertBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      frequency: z.enum(["daily", "weekly", "monthly", "off"]),
      retentionDays: z.number().int().min(7).max(365),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: shop } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!shop) throw new Error("shop_not_found");
    const next = new Date();
    if (data.frequency === "daily") next.setDate(next.getDate() + 1);
    else if (data.frequency === "weekly") next.setDate(next.getDate() + 7);
    else if (data.frequency === "monthly") next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 10); // 'off' → far future

    const { error } = await supabaseAdmin
      .from("backup_schedules")
      .upsert({
        shop_id: shop.id,
        frequency: data.frequency,
        retention_days: data.retentionDays,
        next_run_at: next.toISOString(),
      }, { onConflict: "shop_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBackupSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: shop } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!shop) return null;
    const { data } = await supabase
      .from("backup_schedules")
      .select("frequency, retention_days, last_run_at, next_run_at")
      .eq("shop_id", shop.id)
      .maybeSingle();
    return data;
  });

/**
 * Customer self-export: dump my orders, addresses, loyalty, profile.
 * File ditaruh di bucket customer-exports (RLS path = userId).
 */
export const requestCustomerExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const dump: Record<string, unknown> = {};

    const { data: profile } = await supabaseAdmin
      .from("customer_profiles").select("*").eq("user_id", userId);
    dump.customer_profile = profile ?? [];

    const { data: addresses } = await supabaseAdmin
      .from("customer_addresses").select("*").eq("user_id", userId);
    dump.addresses = addresses ?? [];

    const { data: orders } = await supabaseAdmin
      .from("orders").select("*").eq("customer_user_id", userId);
    dump.orders = orders ?? [];

    const orderIds = ((orders ?? []) as Array<{ id: string }>).map((o) => o.id);
    if (orderIds.length) {
      const { data: items } = await supabaseAdmin
        .from("order_items").select("*").in("order_id", orderIds);
      dump.order_items = items ?? [];
    }

    const { data: loyalty } = await supabaseAdmin
      .from("loyalty_points").select("*").eq("user_id", userId);
    dump.loyalty_points = loyalty ?? [];

    const { data: ledger } = await supabaseAdmin
      .from("loyalty_ledger").select("*").eq("user_id", userId);
    dump.loyalty_ledger = ledger ?? [];

    const payload = JSON.stringify({
      generated_at: new Date().toISOString(),
      user_id: userId,
      data: dump,
    }, null, 2);

    const fileName = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
    const path = `${userId}/${fileName}`;
    const { error } = await supabaseAdmin.storage
      .from("customer-exports")
      .upload(path, new Blob([payload], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
      });
    if (error) throw new Error(error.message);

    const { data: signed } = await supabaseAdmin.storage
      .from("customer-exports")
      .createSignedUrl(path, 60 * 60);
    return { url: signed?.signedUrl ?? null, sizeBytes: payload.length };
  });