// In the client-only Vite build, server-side request middleware does not exist.
// Authentication is enforced through two complementary layers:
//   1. Supabase Row-Level Security (RLS) policies on the database — all data
//      operations are scoped to the authenticated user's JWT automatically.
//   2. Client-side route guards in TanStack Router (see __root.tsx and
//      individual route beforeLoad hooks) that redirect unauthenticated users
//      to /login before any UI is rendered.
//
// API routes (manifest, cron, robots.txt, sitemap.xml) are served by the
// separate api-server Express app (artifacts/api-server).
export const requireSupabaseAuth = null;
