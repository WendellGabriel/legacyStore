-- =====================================================================
-- 0001 · Extensões, tipos (enums) e funções auxiliares
-- =====================================================================

-- Extensões ----------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "unaccent";       -- busca sem acento
create extension if not exists "pg_trgm";        -- busca fuzzy / ILIKE indexada

-- Wrapper IMMUTABLE de unaccent -------------------------------------
-- O unaccent() nativo é STABLE e não pode ser usado em índices.
-- Este wrapper fixa o dicionário e é IMMUTABLE, permitindo indexar.
create or replace function f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select public.unaccent('public.unaccent', $1)
$$;

-- Tipos (enums) ------------------------------------------------------
create type user_role         as enum ('customer', 'admin');
create type product_type      as enum ('box', 'single', 'accessory', 'sealed');
create type relation_type     as enum ('related', 'cross_sell', 'up_sell');
create type discount_type     as enum ('percentage', 'fixed');
create type promotion_scope   as enum ('all', 'category', 'product');
create type stock_move_type   as enum ('sale', 'restock', 'adjustment', 'return', 'cancel');
create type order_status      as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type payment_status    as enum ('pending', 'approved', 'rejected', 'refunded', 'chargeback');
create type payment_method    as enum ('pix', 'card', 'boleto', 'manual');
create type shipping_method    as enum ('recife_zone', 'correios');

-- Função: atualiza updated_at automaticamente -------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Função: verifica se o usuário atual é admin ------------------------
-- SECURITY DEFINER para poder ler a tabela profiles dentro das policies.
-- language plpgsql: resolve public.profiles em tempo de execução, então
-- pode ser criada antes da tabela existir (a tabela vem na migration 0002).
create or replace function is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- Função: gera número de pedido legível (ex: LS-20260713-0001) -------
create sequence if not exists order_number_seq;

create or replace function generate_order_number()
returns text
language plpgsql
as $$
declare
  seq_val bigint;
begin
  seq_val := nextval('order_number_seq');
  return 'LS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq_val::text, 5, '0');
end;
$$;
