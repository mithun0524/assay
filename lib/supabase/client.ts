import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a stub that won't crash but won't do anything useful.
    // This happens during SSR prerendering when env vars aren't set.
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithOAuth: async () => ({ data: {}, error: null }),
        signInWithPassword: async () => ({ data: {}, error: new Error('Supabase not configured') }),
        signUp: async () => ({ data: {}, error: new Error('Supabase not configured') }),
        signOut: async () => ({ error: null }),
        linkIdentity: async () => ({ data: {}, error: new Error('Supabase not configured') }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        upsert: async () => ({ error: null }),
      }),
    } as unknown as SupabaseClient;
  }

  client = createBrowserClient(url, key);
  return client;
}
