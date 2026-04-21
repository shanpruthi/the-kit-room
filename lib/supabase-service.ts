import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let serviceClient: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key (bypasses RLS).
 * Use only for trusted server aggregations — never import from client components.
 *
 * Trends needs this to read all `user_kit_states` rows for charts; the anon key
 * only sees rows RLS allows (often just the current user), so counts stay at 0.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return null
  }

  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return serviceClient
}
