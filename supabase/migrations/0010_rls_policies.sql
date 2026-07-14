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
