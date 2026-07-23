-- =====================================================================
-- 0013 · Pré-venda / lista de interesse (waitlist)
-- =====================================================================
-- Quando um produto zera o estoque ele pode entrar em PRÉ-VENDA (continua
-- listável) e o cliente manifesta interesse deixando um contato. Escopo
-- atual: apenas LISTA DE AVISO (não vende/cobra antecipado).
--
-- Controle pelo admin (dois modos combináveis):
--   (a) automático  → setting global `auto_preorder_on_zero`
--   (b) manual       → coluna `products.allow_preorder` (prioridade sobre o global)
-- Estado "pré-venda" = estoque 0 E (allow_preorder OU auto_preorder_on_zero).
-- =====================================================================

-- flag manual por produto -------------------------------------------
alter table public.products
  add column if not exists allow_preorder boolean not null default false;

-- flag global (automático ao zerar estoque) -------------------------
insert into public.store_settings (key, value, description) values
  ('auto_preorder_on_zero', 'false', 'Ativa pré-venda automaticamente quando o estoque zera')
on conflict (key) do nothing;

-- product_waitlist: interessados por produto ------------------------
create table if not exists public.product_waitlist (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null, -- null p/ convidado
  email       text not null,
  whatsapp    text,
  notified_at timestamptz,                       -- preenchido quando o admin avisa
  created_at  timestamptz not null default now()
);

create index if not exists idx_waitlist_product on public.product_waitlist(product_id);
create index if not exists idx_waitlist_pending on public.product_waitlist(product_id)
  where notified_at is null;

-- evita duplicidade do mesmo contato no mesmo produto (case-insensitive)
create unique index if not exists uq_waitlist_product_email
  on public.product_waitlist (product_id, lower(email));

-- RLS: insert público (guest-friendly), select só admin (ou o próprio dono)
alter table public.product_waitlist enable row level security;

create policy "waitlist: qualquer um registra interesse" on public.product_waitlist
  for insert with check (true);
create policy "waitlist: dono lê o seu" on public.product_waitlist
  for select using (auth.uid() = user_id or is_admin());
create policy "waitlist: admin gerencia" on public.product_waitlist
  for all using (is_admin()) with check (is_admin());
