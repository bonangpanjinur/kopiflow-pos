import { useEffect, useState, useCallback } from "react";
import { getEntitlements, type Entitlements } from "@/server/entitlements.functions";

export function useEntitlements() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
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