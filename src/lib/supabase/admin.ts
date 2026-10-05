import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/env";

/** Service-role client: bypasses RLS. Server routes only. */
export function supabaseAdmin() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
