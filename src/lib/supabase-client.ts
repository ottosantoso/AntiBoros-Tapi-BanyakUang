import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False jika env Supabase belum diisi. Aplikasi menampilkan pesan, bukan error diam. */
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
});
