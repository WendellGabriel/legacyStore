-- =====================================================================
-- 0008 · Frete (zonas Recife), configurações da loja, auditoria
-- =====================================================================

-- shipping_zones: frete personalizado por bairro (RM Recife) ---------
create table public.shipping_zones (
  id            uuid primary key default gen_random_uuid(),
  city          text not null,
  neighborhood  text not null,
  price         numeric(10,2) not null check (price >= 0),
  delivery_days int not null default 1 check (delivery_days >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (city, neighborhood)
);

-- índice para casar bairro/cidade ignorando acento e maiúsculas
create index idx_shipping_zones_lookup
  on public.shipping_zones (lower(f_unaccent(city)), lower(f_unaccent(neighborhood)))
  where is_active;

create trigger trg_shipping_zones_updated
  before update on public.shipping_zones
  for each row execute function set_updated_at();

-- store_settings: chave/valor de configuração global ----------------
create table public.store_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

create trigger trg_store_settings_updated
  before update on public.store_settings
  for each row execute function set_updated_at();

-- audit_log: ações administrativas -----------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,           -- "product.create", "order.status_change"...
  entity      text not null,           -- "products", "orders"...
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_entity on public.audit_log(entity, entity_id);
create index idx_audit_actor  on public.audit_log(actor_id, created_at desc);
