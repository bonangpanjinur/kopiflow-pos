import { createFileRoute } from "@tanstack/react-router";

// This route is a server-only route in TanStack Start.
// In the Vite client build, it's not accessible.
export const Route = createFileRoute("/robots.txt")({
  component: () => null,
});
