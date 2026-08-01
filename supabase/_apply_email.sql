-- =====================================================================
-- APLICAR NO SQL EDITOR DO SUPABASE — e-mail transacional (Resend)
-- =====================================================================
-- Contém:
--   1) migration 0015 (settings de e-mail);
--   2) OPCIONAL: os Database Webhooks em `orders` via SQL (só rode este
--      bloco se preferir SQL ao painel — veja DEPLOY.md).
--
-- Pré-requisitos p/ o e-mail funcionar (ver DEPLOY.md):
--   - deploy da function:  supabase functions deploy order-emails --no-verify-jwt
--   - secrets:             supabase secrets set RESEND_API_KEY=re_... \
--                            EMAIL_FROM="legacyStore <pedidos@SEU_DOMINIO>" \
--                            APP_BASE_URL=https://legacy-store-web.vercel.app
--   - Database Webhook em `orders` (INSERT + UPDATE) → function order-emails
-- =====================================================================

-- 1) SETTINGS (migration 0015) ---------------------------------------
insert into public.store_settings (key, value, description) values
  ('app_base_url', '"https://legacy-store-web.vercel.app"', 'URL pública da loja (usada nos links dos e-mails)'),
  ('store_email',  '""',                                    'E-mail de contato/remetente exibido ao cliente')
on conflict (key) do nothing;

-- 2) OPCIONAL — Database Webhooks via SQL ----------------------------
-- RECOMENDADO usar o painel (Database → Webhooks), que cuida da URL e do
-- header de autorização automaticamente. Se preferir SQL, descomente abaixo.
-- Requer que "Database Webhooks" já esteja habilitado no projeto (isso cria o
-- schema supabase_functions + a extensão pg_net). Ajuste a URL se o ref mudar.
--
-- drop trigger if exists trg_order_email_insert on public.orders;
-- create trigger trg_order_email_insert
--   after insert on public.orders
--   for each row
--   execute function supabase_functions.http_request(
--     'https://oratzgtadilcozstexec.supabase.co/functions/v1/order-emails',
--     'POST',
--     '{"Content-Type":"application/json"}',
--     '{}',
--     '5000'
--   );
--
-- drop trigger if exists trg_order_email_update on public.orders;
-- create trigger trg_order_email_update
--   after update on public.orders
--   for each row
--   execute function supabase_functions.http_request(
--     'https://oratzgtadilcozstexec.supabase.co/functions/v1/order-emails',
--     'POST',
--     '{"Content-Type":"application/json"}',
--     '{}',
--     '5000'
--   );
