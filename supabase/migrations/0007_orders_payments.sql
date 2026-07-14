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
