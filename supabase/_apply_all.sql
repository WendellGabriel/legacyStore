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
-- =====================================================================
-- 0004 · Controle de estoque (histórico de movimentações)
-- =====================================================================

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  type          stock_move_type not null,
  quantity_delta int not null,            -- negativo = saída, positivo = entrada
  reason        text,
  order_id      uuid,                     -- FK adicionada em 0007 (orders ainda não existe)
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_stock_movements_product on public.stock_movements(product_id);
create index idx_stock_movements_order   on public.stock_movements(order_id);

-- Reposição/ajuste manual: aplica delta ao estoque e registra ------
-- (a baixa por venda é feita dentro de create_order, migration 0010)
create or replace function adjust_stock(
  p_product_id uuid,
  p_delta int,
  p_type stock_move_type,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem ajustar estoque';
  end if;

  update public.products
    set stock_quantity = stock_quantity + p_delta
  where id = p_product_id;

  if not found then
    raise exception 'Produto % não encontrado', p_product_id;
  end if;

  insert into public.stock_movements (product_id, type, quantity_delta, reason, created_by)
  values (p_product_id, p_type, p_delta, p_reason, auth.uid());
end;
$$;
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
-- =====================================================================
-- 0006 · Carrinho, lista de desejos, recém-visualizados
-- =====================================================================

-- carts (suporta visitante via session_id) ---------------------------
create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  session_id  text,                       -- carrinho de convidado
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- ou é de um usuário, ou de uma sessão anônima
  check (user_id is not null or session_id is not null)
);

create unique index idx_carts_user    on public.carts(user_id)    where user_id is not null;
create unique index idx_carts_session on public.carts(session_id) where session_id is not null;
create trigger trg_carts_updated
  before update on public.carts
  for each row execute function set_updated_at();

-- cart_items ---------------------------------------------------------
create table public.cart_items (
  id                  uuid primary key default gen_random_uuid(),
  cart_id             uuid not null references public.carts(id) on delete cascade,
  product_id          uuid not null references public.products(id) on delete cascade,
  quantity            int not null check (quantity > 0),
  unit_price_snapshot numeric(10,2) not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index idx_cart_items_cart on public.cart_items(cart_id);
create trigger trg_cart_items_updated
  before update on public.cart_items
  for each row execute function set_updated_at();

-- wishlist_items -----------------------------------------------------
create table public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

create index idx_wishlist_user on public.wishlist_items(user_id);

-- recently_viewed ----------------------------------------------------
create table public.recently_viewed (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  session_id  text,
  product_id  uuid not null references public.products(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  check (user_id is not null or session_id is not null)
);

create index idx_recently_user    on public.recently_viewed(user_id, viewed_at desc);
create index idx_recently_session on public.recently_viewed(session_id, viewed_at desc);
-- =====================================================================
-- 0007 · Pedidos, itens, histórico de status, pagamentos
-- =====================================================================

-- orders -------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique default generate_order_number(),
  user_id           uuid references public.profiles(id) on delete set null,
  status            order_status not null default 'pending',
  -- valores (snapshots do momento da compra)
  subtotal          numeric(10,2) not null,
  discount_total    numeric(10,2) not null default 0,
  shipping_total    numeric(10,2) not null default 0,
  grand_total       numeric(10,2) not null,
  coupon_id         uuid references public.coupons(id) on delete set null,
  -- entrega
  shipping_address  jsonb not null,               -- snapshot do endereço
  shipping_method   shipping_method not null,
  shipping_service  text,                          -- "PAC", "SEDEX", "Entrega local"
  shipping_days     int,
  tracking_code     text,
  -- pagamento
  payment_status    payment_status not null default 'pending',
  payment_method    payment_method,
  customer_email    text,
  customer_phone    text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_orders_user   on public.orders(user_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_created on public.orders(created_at desc);
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function set_updated_at();

-- order_items (imutável: guarda snapshot de nome/sku/preço) ----------
create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  sku_snapshot  text not null,
  unit_price    numeric(10,2) not null,
  quantity      int not null check (quantity > 0),
  line_total    numeric(10,2) not null,
  created_at    timestamptz not null default now()
);

create index idx_order_items_order on public.order_items(order_id);

-- order_status_history -----------------------------------------------
create table public.order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_status order_status,
  to_status   order_status not null,
  note        text,
  changed_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_order_history_order on public.order_status_history(order_id, created_at);

-- Registra automaticamente toda mudança de status -------------------
create or replace function log_order_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_order_status_log
  after update on public.orders
  for each row execute function log_order_status_change();

-- payments -----------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  provider            text not null default 'mercadopago',
  method              payment_method not null,
  amount              numeric(10,2) not null,
  status              payment_status not null default 'pending',
  provider_payment_id text,
  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_payments_order    on public.payments(order_id);
create index idx_payments_provider on public.payments(provider_payment_id);
create trigger trg_payments_updated
  before update on public.payments
  for each row execute function set_updated_at();

-- FK tardia: stock_movements.order_id → orders -----------------------
alter table public.stock_movements
  add constraint fk_stock_movements_order
  foreign key (order_id) references public.orders(id) on delete set null;
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
-- =====================================================================
-- 0009 · RPCs de pedido: validação de cupom e criação atômica
-- =====================================================================

-- Valida um cupom e retorna o desconto calculado --------------------
create or replace function validate_coupon(
  p_code text,
  p_order_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  c public.coupons;
  v_discount numeric(10,2);
begin
  select * into c from public.coupons
   where upper(code) = upper(p_code) and is_active
   limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'Cupom inválido');
  end if;

  if c.starts_at is not null and now() < c.starts_at then
    return jsonb_build_object('valid', false, 'reason', 'Cupom ainda não começou');
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return jsonb_build_object('valid', false, 'reason', 'Cupom expirado');
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'Cupom esgotado');
  end if;
  if p_order_total < c.min_order_total then
    return jsonb_build_object('valid', false, 'reason',
      'Pedido mínimo de R$ ' || c.min_order_total);
  end if;

  if c.discount_type = 'percentage' then
    v_discount := round(p_order_total * c.value / 100, 2);
  else
    v_discount := least(c.value, p_order_total);
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', c.id,
    'discount', v_discount
  );
end;
$$;

-- Cria um pedido de forma ATÔMICA -----------------------------------
-- Valida estoque, trava as linhas, baixa estoque, cria pedido+itens.
-- p_items: jsonb array de { product_id, quantity }
-- Retorna o pedido criado.
create or replace function create_order(
  p_items           jsonb,
  p_shipping_address jsonb,
  p_shipping_method  shipping_method,
  p_shipping_service text,
  p_shipping_total   numeric,
  p_shipping_days    int,
  p_coupon_code      text default null,
  p_customer_email   text default null,
  p_customer_phone   text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  item          jsonb;
  v_product     public.products;
  v_qty         int;
  v_subtotal    numeric(10,2) := 0;
  v_discount    numeric(10,2) := 0;
  v_coupon      jsonb;
  v_coupon_id   uuid := null;
  v_order       public.orders;
begin
  -- 1ª passada: travar produtos e validar estoque (FOR UPDATE evita corrida)
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (item->>'quantity')::int;
    if v_qty <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select * into v_product from public.products
     where id = (item->>'product_id')::uuid and is_active
     for update;

    if not found then
      raise exception 'Produto indisponível';
    end if;
    if v_product.stock_quantity < v_qty then
      raise exception 'Estoque insuficiente para "%": restam %',
        v_product.name, v_product.stock_quantity;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  -- cupom (opcional)
  if p_coupon_code is not null then
    v_coupon := validate_coupon(p_coupon_code, v_subtotal);
    if (v_coupon->>'valid')::boolean then
      v_discount  := (v_coupon->>'discount')::numeric;
      v_coupon_id := (v_coupon->>'coupon_id')::uuid;
    else
      raise exception 'Cupom: %', v_coupon->>'reason';
    end if;
  end if;

  -- cria o pedido
  insert into public.orders (
    user_id, subtotal, discount_total, shipping_total, grand_total,
    coupon_id, shipping_address, shipping_method, shipping_service,
    shipping_days, customer_email, customer_phone
  ) values (
    auth.uid(), v_subtotal, v_discount, p_shipping_total,
    v_subtotal - v_discount + p_shipping_total,
    v_coupon_id, p_shipping_address, p_shipping_method, p_shipping_service,
    p_shipping_days, p_customer_email, p_customer_phone
  )
  returning * into v_order;

  -- 2ª passada: cria itens, baixa estoque, registra movimentação
  for item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (item->>'quantity')::int;
    select * into v_product from public.products
     where id = (item->>'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, name_snapshot, sku_snapshot,
      unit_price, quantity, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.sku,
      v_product.price, v_qty, v_product.price * v_qty
    );

    update public.products
       set stock_quantity = stock_quantity - v_qty
     where id = v_product.id;

    insert into public.stock_movements (product_id, type, quantity_delta, order_id, reason)
    values (v_product.id, 'sale', -v_qty, v_order.id, 'Venda #' || v_order.order_number);
  end loop;

  -- incrementa uso do cupom
  if v_coupon_id is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon_id;
  end if;

  return v_order;
end;
$$;
-- =====================================================================
-- 0010 · Row Level Security — habilita RLS e define policies
-- =====================================================================
-- Estratégia:
--   * catálogo público: leitura livre do que está ativo
--   * dados do usuário: só o dono acessa (auth.uid())
--   * admin: acesso total via is_admin()
-- =====================================================================

-- Habilita RLS em todas as tabelas -----------------------------------
alter table public.profiles            enable row level security;
alter table public.addresses           enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.product_relations   enable row level security;
alter table public.reviews             enable row level security;
alter table public.stock_movements     enable row level security;
alter table public.banners             enable row level security;
alter table public.promotions          enable row level security;
alter table public.coupons             enable row level security;
alter table public.carts               enable row level security;
alter table public.cart_items          enable row level security;
alter table public.wishlist_items      enable row level security;
alter table public.recently_viewed     enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments            enable row level security;
alter table public.shipping_zones      enable row level security;
alter table public.store_settings      enable row level security;
alter table public.audit_log           enable row level security;

-- PROFILES -----------------------------------------------------------
create policy "profiles: dono lê" on public.profiles
  for select using (auth.uid() = id or is_admin());
create policy "profiles: dono atualiza" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: admin gerencia" on public.profiles
  for all using (is_admin()) with check (is_admin());

-- ADDRESSES ----------------------------------------------------------
create policy "addresses: dono gerencia" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "addresses: admin lê" on public.addresses
  for select using (is_admin());

-- CATÁLOGO (leitura pública do ativo, escrita só admin) --------------
create policy "categories: público lê ativo" on public.categories
  for select using (is_active or is_admin());
create policy "categories: admin gerencia" on public.categories
  for all using (is_admin()) with check (is_admin());

create policy "products: público lê ativo" on public.products
  for select using (is_active or is_admin());
create policy "products: admin gerencia" on public.products
  for all using (is_admin()) with check (is_admin());

create policy "product_images: público lê" on public.product_images
  for select using (true);
create policy "product_images: admin gerencia" on public.product_images
  for all using (is_admin()) with check (is_admin());

create policy "product_relations: público lê" on public.product_relations
  for select using (true);
create policy "product_relations: admin gerencia" on public.product_relations
  for all using (is_admin()) with check (is_admin());

-- REVIEWS ------------------------------------------------------------
create policy "reviews: público lê aprovado" on public.reviews
  for select using (is_approved or auth.uid() = user_id or is_admin());
create policy "reviews: usuário cria" on public.reviews
  for insert with check (auth.uid() = user_id);
create policy "reviews: dono edita" on public.reviews
  for update using (auth.uid() = user_id);
create policy "reviews: admin gerencia" on public.reviews
  for all using (is_admin()) with check (is_admin());

-- STOCK MOVEMENTS (só admin) -----------------------------------------
create policy "stock: admin" on public.stock_movements
  for all using (is_admin()) with check (is_admin());

-- MARKETING (leitura pública do ativo, escrita admin) ----------------
create policy "banners: público lê ativo" on public.banners
  for select using (
    is_active
    and (starts_at is null or now() >= starts_at)
    and (ends_at is null or now() <= ends_at)
    or is_admin()
  );
create policy "banners: admin gerencia" on public.banners
  for all using (is_admin()) with check (is_admin());

create policy "promotions: público lê ativo" on public.promotions
  for select using (is_active or is_admin());
create policy "promotions: admin gerencia" on public.promotions
  for all using (is_admin()) with check (is_admin());

-- coupons: NÃO exposto ao público (validação via RPC). Só admin.
create policy "coupons: admin gerencia" on public.coupons
  for all using (is_admin()) with check (is_admin());

-- CARRINHO (dono por user_id; convidado é tratado via API/service_role)
create policy "carts: dono gerencia" on public.carts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cart_items: dono gerencia" on public.cart_items
  for all using (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
  );

-- WISHLIST -----------------------------------------------------------
create policy "wishlist: dono gerencia" on public.wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RECENTLY VIEWED ----------------------------------------------------
create policy "recently: dono gerencia" on public.recently_viewed
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ORDERS (dono lê; escrita via RPC/service_role; admin total) --------
create policy "orders: dono lê" on public.orders
  for select using (auth.uid() = user_id or is_admin());
create policy "orders: admin gerencia" on public.orders
  for all using (is_admin()) with check (is_admin());

create policy "order_items: dono lê" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id
            and (o.user_id = auth.uid() or is_admin()))
  );
create policy "order_items: admin gerencia" on public.order_items
  for all using (is_admin()) with check (is_admin());

create policy "order_history: dono lê" on public.order_status_history
  for select using (
    exists (select 1 from public.orders o where o.id = order_id
            and (o.user_id = auth.uid() or is_admin()))
  );
create policy "order_history: admin gerencia" on public.order_status_history
  for all using (is_admin()) with check (is_admin());

create policy "payments: dono lê" on public.payments
  for select using (
    exists (select 1 from public.orders o where o.id = order_id
            and (o.user_id = auth.uid() or is_admin()))
  );
create policy "payments: admin gerencia" on public.payments
  for all using (is_admin()) with check (is_admin());

-- SHIPPING ZONES (leitura pública p/ cálculo, escrita admin) ---------
create policy "shipping_zones: público lê ativo" on public.shipping_zones
  for select using (is_active or is_admin());
create policy "shipping_zones: admin gerencia" on public.shipping_zones
  for all using (is_admin()) with check (is_admin());

-- STORE SETTINGS (leitura pública, escrita admin) --------------------
create policy "settings: público lê" on public.store_settings
  for select using (true);
create policy "settings: admin gerencia" on public.store_settings
  for all using (is_admin()) with check (is_admin());

-- AUDIT LOG (só admin) -----------------------------------------------
create policy "audit: admin lê" on public.audit_log
  for select using (is_admin());
-- =====================================================================
-- SEED · Dados iniciais do legacyStore
-- =====================================================================

-- CONFIGURAÇÕES DA LOJA ---------------------------------------------
insert into public.store_settings (key, value, description) values
  ('store_name',    '"legacyStore"',                      'Nome da loja'),
  ('whatsapp',      '"5581000000000"',                    'WhatsApp de atendimento (DDI+DDD+num)'),
  ('free_shipping_threshold', '299.90',                   'Frete grátis acima de'),
  ('ga_measurement_id', '""',                             'Google Analytics 4 ID'),
  ('meta_pixel_id', '""',                                 'Meta Pixel ID'),
  ('origin_cep',    '"50000000"',                         'CEP de origem (loja) p/ Correios')
on conflict (key) do nothing;

-- CATEGORIAS RAIZ (por jogo) ----------------------------------------
insert into public.categories (id, name, slug, position) values
  ('11111111-1111-1111-1111-111111111101', 'Pokémon',      'pokemon',      1),
  ('11111111-1111-1111-1111-111111111102', 'Magic',        'magic',        2),
  ('11111111-1111-1111-1111-111111111103', 'Yu-Gi-Oh!',    'yugioh',       3),
  ('11111111-1111-1111-1111-111111111104', 'One Piece',    'one-piece',    4),
  ('11111111-1111-1111-1111-111111111105', 'Lorcana',      'lorcana',      5),
  ('11111111-1111-1111-1111-111111111106', 'Dragon Ball',  'dragon-ball',  6),
  ('11111111-1111-1111-1111-111111111107', 'Acessórios',   'acessorios',   7)
on conflict (id) do nothing;

-- SUBCATEGORIAS de Pokémon (exemplo) --------------------------------
insert into public.categories (name, slug, parent_id, position) values
  ('Boxes de Booster', 'pokemon-boxes',       '11111111-1111-1111-1111-111111111101', 1),
  ('Cartas Avulsas',   'pokemon-avulsas',     '11111111-1111-1111-1111-111111111101', 2),
  ('Blisters',         'pokemon-blisters',    '11111111-1111-1111-1111-111111111101', 3),
  ('Produtos Selados', 'pokemon-selados',     '11111111-1111-1111-1111-111111111101', 4)
on conflict (slug) do nothing;

-- PRODUTOS DE EXEMPLO -----------------------------------------------
insert into public.products
  (sku, name, slug, description, category_id, product_type, price, compare_at_price,
   stock_quantity, weight_grams, is_featured, is_active)
values
  ('PKM-BOX-001', 'Caixa de Booster - Megaevolução 5', 'caixa-booster-megaevolucao-5',
   'Caixa lacrada com 36 boosters da coleção Megaevolução 5.',
   (select id from public.categories where slug = 'pokemon-boxes'),
   'box', 427.48, 449.99, 60, 500, true, true),
  ('PKM-BOX-002', 'Booster Box - Prismatic Evolutions', 'booster-box-prismatic-evolutions',
   'Booster box importada Prismatic Evolutions.',
   (select id from public.categories where slug = 'pokemon-boxes'),
   'box', 899.99, null, 8, 500, true, true),
  ('PKM-SGL-001', 'Dragapult ex (#130/167)', 'dragapult-ex-130-167',
   'Carta avulsa foil, Twilight Masquerade.',
   (select id from public.categories where slug = 'pokemon-avulsas'),
   'single', 5.69, 5.99, 218, 10, false, true),
  ('ACC-SLV-001', 'Dragon Shield - Matte - Sapphire', 'dragon-shield-matte-sapphire',
   'Pacote com 100 sleeves matte.',
   (select id from public.categories where slug = 'acessorios'),
   'accessory', 110.00, null, 2, 120, false, true)
on conflict (sku) do nothing;

-- BANNER DE EXEMPLO --------------------------------------------------
insert into public.banners (title, image_url, link_url, position, is_active) values
  ('Megaevolução 5 chegou', 'https://placehold.co/1600x500?text=Megaevolucao+5', '/c/pokemon', 1, true)
on conflict do nothing;

-- CUPOM DE EXEMPLO ---------------------------------------------------
insert into public.coupons (code, discount_type, value, min_order_total, per_user_limit) values
  ('PRIMEIRACOMPRA', 'fixed', 15.00, 150.00, 1)
on conflict (code) do nothing;

-- ZONAS DE FRETE - RM RECIFE (exemplo) ------------------------------
insert into public.shipping_zones (city, neighborhood, price, delivery_days) values
  ('Recife',        'Boa Viagem',     12.00, 1),
  ('Recife',        'Casa Amarela',   15.00, 1),
  ('Recife',        'Boa Vista',      12.00, 1),
  ('Olinda',        'Casa Caiada',    18.00, 2),
  ('Jaboatão dos Guararapes', 'Piedade', 18.00, 2)
on conflict (city, neighborhood) do nothing;

-- =====================================================================
-- ADMIN: após se cadastrar pela primeira vez no site, rode:
--   update public.profiles set role = 'admin' where id = 'SEU_USER_ID';
-- (pegue o SEU_USER_ID em Authentication > Users no painel do Supabase)
-- =====================================================================
