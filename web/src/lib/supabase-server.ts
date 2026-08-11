import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-side client for API routes. Uses the anon key + the temporary
// anon-role RLS policy (see docs/architecture.md migration
// temp_allow_anon_pre_oauth) -- swap for a service-role key once real
// auth exists.
export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function checkAgentAuth(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return Boolean(process.env.AGENT_API_KEY) && token === process.env.AGENT_API_KEY;
}
