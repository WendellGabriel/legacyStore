import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com service_role — SÓ no servidor.
 * Bypassa a RLS; nunca exponha essa chave ao browser.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL ?? process.env.NG_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no servidor.');
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
