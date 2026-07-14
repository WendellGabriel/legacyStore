-- =====================================================================
-- 0005 · Marketing: banners, promoções, cupons
-- =====================================================================

-- banners ------------------------------------------------------------
create table public.banners (
  id               uuid primary key default gen_random_uuid(),
  title            text,
  image_url        text not null,
  mobile_image_url text,
  link_url         text,
  position         int not null default 0,
  is_active        boolean not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_banners_active on public.banners(is_active, position) where is_active;
create trigger trg_banners_updated
  before update on public.banners
  for each row execute function set_updated_at();

-- promotions (regra de desconto aplicada a produtos/categorias) ------
create table public.promotions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  discount_type discount_type not null,
  value         numeric(10,2) not null check (value >= 0),
  scope         promotion_scope not null default 'all',
  target_id     uuid,               -- category_id ou product_id conforme o scope
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_promotions_active on public.promotions(is_active) where is_active;
create trigger trg_promotions_updated
  before update on public.promotions
  for each row execute function set_updated_at();

-- coupons ------------------------------------------------------------
create table public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  discount_type   discount_type not null,
  value           numeric(10,2) not null check (value >= 0),
  min_order_total numeric(10,2) not null default 0,
  max_uses        int,                -- null = ilimitado
  used_count      int not null default 0,
  per_user_limit  int not null default 1,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_coupons_code on public.coupons(upper(code));
create trigger trg_coupons_updated
  before update on public.coupons
  for each row execute function set_updated_at();
