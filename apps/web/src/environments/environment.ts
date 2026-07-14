// Configuração pública do frontend.
// A anon/publishable key é PÚBLICA por design — a segurança real vem da RLS
// no Supabase. NÃO coloque a service_role key aqui.
export const environment = {
  production: true,
  supabaseUrl: 'https://oratzgtadilcozstexec.supabase.co',
  supabaseAnonKey: 'sb_publishable_A3uN23p36xL1u095A1nBxw_ighB3rjX',
  apiBaseUrl: '/api',
};
