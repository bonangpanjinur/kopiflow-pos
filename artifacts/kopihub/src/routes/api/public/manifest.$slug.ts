import { createFileRoute } from "@tanstack/react-router";

// This route is a server-only API route in TanStack Start.
// In the client-only Vite build, the PWA manifest is served statically.
export const Route = createFileRoute("/api/public/manifest/$slug")({
  component: () => null,
});
