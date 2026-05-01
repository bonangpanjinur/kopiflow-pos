import { useEffect, useState, useCallback } from "react";

export type EntitlementFeature = {
  key: string;
  name: string;
  description: string | null;
  category: string;
  requires_min_months: number;
  limit_value: number | null;
  allowed: boolean;
  reason: string | null;
};

export type EntitlementTheme = {
  key: string;
  name: string;
  description: string | null;
  preview_image_url: string | null;
  component_id: string;
  requires_min_months: number;
  allowed: boolean;
  reason: string | null;
};

export type Entitlements = {
  plan_code: string;
  plan_expires_at: string | null;
  plan_started_at: string | null;
  months_active: number;
  active_theme_key: string;
  features: EntitlementFeature[];
  themes: EntitlementTheme[];
};

export function useEntitlements() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { getEntitlements } = await import("@/server/entitlements.functions.server");
      const r = await getEntitlements();
      // Defensive: ensure features & themes are arrays even if RPC returns null
      const safe: Entitlements = {
        ...r,
        features: Array.isArray(r?.features) ? r.features : [],
        themes: Array.isArray(r?.themes) ? r.themes : [],
      };
      setData(safe);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const hasFeature = useCallback((key: string) => {
    if (!data) return false;
    const features = Array.isArray(data.features) ? data.features : [];
    return features.some((f) => f.key === key && f.allowed);
  }, [data]);

  return {
    entitlements: data,
    loading,
    error,
    hasFeature,
    isPro: data ? data.plan_code !== "basic" && data.plan_code !== "free" : false,
    planCode: data?.plan_code ?? "basic",
    monthsActive: data?.months_active ?? 0,
    themes: Array.isArray(data?.themes) ? data.themes : [],
    activeThemeKey: data?.active_theme_key ?? "classic",
    reload,
  };
}
