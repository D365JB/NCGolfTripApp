import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cloud sync is optional: the app runs fully local-first until these env vars are set.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isCloudEnabled = supabase !== null;
