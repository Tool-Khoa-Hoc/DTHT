import { createClient } from '@supabase/supabase-js';

export const TRAM_SV_PROJECT_REF = 'szvzwnbdjixcvgbgpavf';

const FALLBACK_SUPABASE_URL = `https://${TRAM_SV_PROJECT_REF}.supabase.co`;
const FALLBACK_SUPABASE_ANON_KEY = 'missing-supabase-anon-key';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!rawSupabaseUrl || !rawSupabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. Authentication and database requests will fail until configured.',
  );
}

export const supabase = createClient(
  rawSupabaseUrl || FALLBACK_SUPABASE_URL,
  rawSupabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    },
    db: { schema: 'public' },
    global: {
      headers: { 'x-application-name': 'tram-hs-sv' },
    },
  },
);
