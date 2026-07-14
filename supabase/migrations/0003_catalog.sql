-- =====================================================================
-- 0003 · Catálogo: categorias, produtos, imagens, relações, avaliações
-- =====================================================================

-- categories (self-referenciada → jogos > subcategorias) -------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories(id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  position    int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_categories_parent on public.categories(parent_id);
create index idx_categories_active on public.categories(is_active) where is_active;
create trigger trg_categories_updated
  before update on public.categories
  for each row execute function set_updated_at();

-- products -----------------------------------------------------------
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique,
  name            text not null,
  slug            text not null unique,
  description     text,
  category_id     uuid references public.categories(id) on delete set null,
  product_type    product_type not null default 'single',
  price           numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price >= 0), -- preço "de" (promoção)
  cost            numeric(10,2) check (cost >= 0),
  -- estoque
  stock_quantity  int not null default 0 check (stock_quantity >= 0),
  low_stock_threshold int not null default 5,
  -- logística
  weight_grams    int check (weight_grams >= 0),
  length_cm       numeric(6,2) check (length_cm >= 0),
  width_cm        numeric(6,2) check (width_cm >= 0),
  height_cm       numeric(6,2) check (height_cm >= 0),
  -- flags
  is_featured     boolean not null default false,
  is_active       boolean not null default true,
  -- SEO
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_products_category on public.products(category_id);
create index idx_products_active   on public.products(is_active) where is_active;
create index idx_products_featured on public.products(is_featured) where is_featured;
-- promoção = compare_at_price > price
create index idx_products_on_sale  on public.products(id)
  where compare_at_price is not null;
-- busca textual por nome (fuzzy, sem acento)
create index idx_products_name_trgm on public.products
  using gin (f_unaccent(name) gin_trgm_ops);

create trigger trg_products_updated
  before update on public.products
  for each row execute function set_updated_at();

-- product_images -----------------------------------------------------
create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  alt         text,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_product_images_product on public.product_images(product_id);

-- product_relations (relacionados / cross-sell / up-sell) ------------
create table public.product_relations (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  related_id    uuid not null references public.products(id) on delete cascade,
  relation_type relation_type not null default 'related',
  position      int not null default 0,
  check (product_id <> related_id),
  unique (product_id, related_id, relation_type)
);

create index idx_product_relations_product on public.product_relations(product_id);

-- reviews ------------------------------------------------------------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  title       text,
  body        text,
  images      text[] default '{}',
  is_approved boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, user_id)   -- 1 avaliação por produto por usuário
);

create index idx_reviews_product on public.reviews(product_id) where is_approved;
create trigger trg_reviews_updated
  before update on public.reviews
  for each row execute function set_updated_at();
