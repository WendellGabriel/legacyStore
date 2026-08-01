-- =====================================================================
-- 0015 · Configurações para e-mail transacional (Resend)
-- =====================================================================
-- Os e-mails (pedido recebido / pago / enviado) são enviados pela Edge
-- Function `order-emails`, disparada por um Database Webhook em `orders`
-- (INSERT/UPDATE). A function lê o remetente e a base URL de secrets/env
-- (EMAIL_FROM, APP_BASE_URL); estas linhas servem de fallback/documentação
-- e para exibição no admin.
--
-- Sem RESEND_API_KEY configurada na function, o envio é um no-op silencioso
-- (nada quebra no fluxo do pedido).
-- =====================================================================

insert into public.store_settings (key, value, description) values
  ('app_base_url', '"https://legacy-store-web.vercel.app"', 'URL pública da loja (usada nos links dos e-mails)'),
  ('store_email',  '""',                                    'E-mail de contato/remetente exibido ao cliente')
on conflict (key) do nothing;
