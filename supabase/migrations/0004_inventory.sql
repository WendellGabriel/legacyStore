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
