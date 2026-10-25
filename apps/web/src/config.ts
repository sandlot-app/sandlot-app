export type SupabaseConfig = { url: string; anonKey: string };

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey } = import.meta.env;

export const supabaseConfig: SupabaseConfig | null = url && anonKey ? { url, anonKey } : null;
