// Server-only Supabase admin client stub for client-only Vite build.
// All operations that need service-role access must go through your backend API or Supabase RLS.
// This file should NOT be imported by any client-side code.

import { supabase } from "./client";

// Expose the regular client as a fallback so the build doesn't break.
// Server-privileged ops will fail with RLS if user is not authenticated.
export const supabaseAdmin = supabase;
