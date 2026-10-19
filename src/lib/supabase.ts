import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const COMPLAINT_PHOTOS_BUCKET = 'complaint-photos';

let client: SupabaseClient | null = null;

/** Server-side Supabase client with the service role key (bypasses RLS) */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Never let Next.js cache database reads
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return client;
}

/** Throws the Supabase error so callers don't silently lose writes */
export function check<T>(result: { data: T; error: { message: string } | null }, action: string): T {
  if (result.error) throw new Error(`Supabase: ${action} failed: ${result.error.message}`);
  return result.data;
}
