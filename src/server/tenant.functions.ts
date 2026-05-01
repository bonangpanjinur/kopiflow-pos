import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// This file is now primarily for RPC actions that don't cause import protection issues
// when called from client handlers. Route-level loaders and head functions should
// define their own server functions locally with dynamic imports to avoid bundling
// server-only code into the client.
