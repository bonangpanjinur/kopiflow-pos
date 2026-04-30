import { lazy, Suspense, type ComponentType } from "react";
import type { ThemeHomeProps } from "./types";

const ClassicHome = lazy(() => import("./classic/Home"));
const MinimalHome = lazy(() => import("./minimal/Home"));

const HOMES: Record<string, ComponentType<ThemeHomeProps>> = {
  classic: ClassicHome,
  minimal: MinimalHome,
  // dark-luxe & vibrant fallback ke classic untuk batch ini
  "dark-luxe": ClassicHome,
  vibrant: ClassicHome,
};

export function ThemedHome({ themeKey, ...props }: ThemeHomeProps & { themeKey: string }) {
  const Comp = HOMES[themeKey] ?? ClassicHome;
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Memuat tema…</p>}>
      <Comp {...props} />
    </Suspense>
  );
}