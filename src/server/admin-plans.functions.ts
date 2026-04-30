import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureSuperAdmin(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("not_authorized");
}

export const upsertPlanFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    planId: z.string().uuid(),
    featureKey: z.string().min(1).max(64),
    requiresMinMonths: z.number().int().min(0).max(120).default(0),
    limitValue: z.number().int().nullable().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureSuperAdmin(supabase, userId);
    const { error } = await supabase.rpc("admin_upsert_plan_feature", {
      _plan_id: data.planId,
      _feature_key: data.featureKey,
      _requires_min_months: data.requiresMinMonths,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _limit_value: (data.limitValue ?? null) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _meta: (data.meta ?? {}) as any,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePlanFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    planId: z.string().uuid(),
    featureKey: z.string().min(1).max(64),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureSuperAdmin(supabase, userId);
    const { error } = await supabase.rpc("admin_remove_plan_feature", {
      _plan_id: data.planId, _feature_key: data.featureKey,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertPlanTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    planId: z.string().uuid(),
    themeKey: z.string().min(1).max(64),
    requiresMinMonths: z.number().int().min(0).max(120).default(0),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureSuperAdmin(supabase, userId);
    const { error } = await supabase.rpc("admin_upsert_plan_theme", {
      _plan_id: data.planId, _theme_key: data.themeKey,
      _requires_min_months: data.requiresMinMonths,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePlanTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    planId: z.string().uuid(),
    themeKey: z.string().min(1).max(64),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureSuperAdmin(supabase, userId);
    const { error } = await supabase.rpc("admin_remove_plan_theme", {
      _plan_id: data.planId, _theme_key: data.themeKey,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertFeatureCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
    category: z.string().min(1).max(40).default("general"),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureSuperAdmin(supabase, userId);
    const { error } = await supabase.rpc("admin_upsert_feature", {
      _key: data.key, _name: data.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _description: (data.description ?? null) as any,
      _category: data.category, _is_active: data.isActive, _sort_order: data.sortOrder,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertThemeCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    key: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullable().optional(),
    componentId: z.string().min(1).max(64),
    previewImageUrl: z.string().url().nullable().optional(),
    tierHint: z.string().max(120).nullable().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureSuperAdmin(supabase, userId);
    const { error } = await supabase.rpc("admin_upsert_theme", {
      _key: data.key, _name: data.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _description: (data.description ?? null) as any,
      _component_id: data.componentId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _preview_image_url: (data.previewImageUrl ?? null) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _tier_hint: (data.tierHint ?? null) as any,
      _is_active: data.isActive, _sort_order: data.sortOrder,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });