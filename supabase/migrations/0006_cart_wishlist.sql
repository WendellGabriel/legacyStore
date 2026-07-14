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
