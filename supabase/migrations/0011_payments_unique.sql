-- =====================================================================
-- 0011 · Constraint única para upsert de pagamentos pelo id do provedor
-- =====================================================================
-- Permite ON CONFLICT (provider_payment_id) no webhook do Mercado Pago.
-- Nulls são permitidos e não conflitam entre si (padrão do Postgres).

alter table public.payments
  add constraint uq_payments_provider_payment_id unique (provider_payment_id);
