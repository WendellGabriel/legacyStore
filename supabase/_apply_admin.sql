-- =====================================================================
-- 0011 · Constraint única para upsert de pagamentos pelo id do provedor
-- =====================================================================
-- Permite ON CONFLICT (provider_payment_id) no webhook do Mercado Pago.
-- Nulls são permitidos e não conflitam entre si (padrão do Postgres).

alter table public.payments
  add constraint uq_payments_provider_payment_id unique (provider_payment_id);
-- =====================================================================
-- 0012 · RPC de estatísticas do dashboard administrativo
-- =====================================================================
-- Retorna KPIs num único jsonb. Só admin pode chamar.

create or replace function admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not is_admin() then
    raise exception 'Acesso negado';
  end if;

  select jsonb_build_object(
    'revenue', coalesce((select sum(grand_total) from orders
                          where payment_status = 'approved'), 0),
    'paid_orders', (select count(*) from orders where payment_status = 'approved'),
    'pending_orders', (select count(*) from orders where status = 'pending'),
    'total_orders', (select count(*) from orders),
    'total_products', (select count(*) from products where is_active),
    'total_customers', (select count(*) from profiles where role = 'customer'),
    'low_stock', (select count(*) from products
                  where is_active and stock_quantity > 0
                    and stock_quantity <= low_stock_threshold),
    'out_of_stock', (select count(*) from products
                     where is_active and stock_quantity = 0),
    'revenue_last_7_days', (
      select coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb) from (
        select
          to_char(day, 'YYYY-MM-DD') as date,
          coalesce(sum(o.grand_total), 0) as total
        from generate_series(current_date - interval '6 days', current_date, interval '1 day') as day
        left join orders o
          on date(o.created_at) = day and o.payment_status = 'approved'
        group by day
        order by day
      ) d
    ),
    'top_products', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select oi.name_snapshot as name, sum(oi.quantity) as sold
        from order_items oi
        join orders o on o.id = oi.order_id
        where o.payment_status = 'approved'
        group by oi.name_snapshot
        order by sold desc
        limit 5
      ) t
    )
  ) into result;

  return result;
end;
$$;
