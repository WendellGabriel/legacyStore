-- =====================================================================
-- 0002 · Perfis de usuário e endereços
-- =====================================================================

-- profiles: estende auth.users -------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  cpf         text unique,
  role        user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function set_updated_at();

-- Cria um profile automaticamente quando um usuário se cadastra ------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- addresses ----------------------------------------------------------
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text,                       -- "Casa", "Trabalho"
  recipient   text not null,              -- nome de quem recebe
  cep         text not null,
  street      text not null,
  number      text not null,
  complement  text,
  neighborhood text not null,
  city        text not null,
  state       char(2) not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_addresses_user on public.addresses(user_id);
create trigger trg_addresses_updated
  before update on public.addresses
  for each row execute function set_updated_at();

-- Garante apenas um endereço padrão por usuário ----------------------
create unique index idx_addresses_one_default
  on public.addresses(user_id)
  where is_default;
