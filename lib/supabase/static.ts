import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-free Supabase client for use inside `unstable_cache` callbacks,
 * which run outside the request context and cannot read cookies.
 *
 * Safe in this project because no RLS policies exist. If RLS is ever added
 * to any table, this client will silently return empty arrays for that table —
 * audit all callers and migrate to a service-role client + caller-side auth.
 */
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
