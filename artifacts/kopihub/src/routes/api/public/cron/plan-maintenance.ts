import { createFileRoute } from "@tanstack/react-router";

// This is a server-only cron route in TanStack Start.
// Not accessible in the client-only Vite build.
export const Route = createFileRoute("/api/public/cron/plan-maintenance")({
  component: () => null,
});
