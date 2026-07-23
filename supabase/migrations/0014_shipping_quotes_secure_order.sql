-- =====================================================================
-- 0014 · Frete autoritativo no servidor (corrige A1 do SECURITY.md)
-- =====================================================================
-- Antes, create_order() confiava no p_shipping_total vindo do cliente, o que
-- permitia manipular o total do pedido (e a cobrança no Mercado Pago).
--
-- Agora a Edge Function store-api persiste cada cotação em `shipping_quotes`
-- (só service_role escreve) e devolve um quote_id. O create_order passa a ler
-- o preço/prazo dessa cotação, validando que os itens conferem e que não
-- expirou — ignorando qualquer valor de frete enviado pelo cliente.
--
-- Compatibilidade: p_quote_id é opcional. Sem ele, mantém o comportamento
-- antigo (apenas com check de frete >= 0) para não quebrar durante o rollout.
-- =====================================================================

-- Tabela de cotações de frete (autoritativa) ------------------------
create table if not exists public.shipping_quotes (
  id            uuid primary key default gen_random_uuid(),
  cep           text not null,
  items         jsonb not null,                 -- [{ product_id, quantity }]
  method        shipping_method not null,
  service       text not null,
  price         numeric(10,2) not null check (price >= 0),
  delivery_days int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_shipping_quotes_created on public.shipping_quotes(created_at);

-- RLS: nenhum acesso público. Só service_role (Edge Function) escreve e
-- create_order (SECURITY DEFINER = owner) lê. Sem policies = nega tudo ao anon.
alter table public.shipping_quotes enable row level security;

-- create_order com frete autoritativo -------------------------------
drop function if exists create_order(jsonb, jsonb, shipping_method, text, numeric, int, text, text, text);

create or replace function create_order(
  p_items            jsonb,
  p_shipping_address jsonb,
  p_shipping_method  shipping_method,
  p_shipping_service text,
  p_shipping_total   numeric,
  p_shipping_days    int,
  p_coupon_code      text default null,
  p_customer_email   text default null,
  p_customer_phone   text default null,
  p_quote_id         uuid default null
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
  v_quote       public.shipping_quotes;
  -- valores de frete efetivamente usados (autoritativos quando há cotação)
  v_ship_total   numeric(10,2);
  v_ship_method  shipping_method;
  v_ship_service text;
  v_ship_days    int;
begin
  -- Resolve o frete de forma autoritativa quando um quote_id é fornecido.
  if p_quote_id is not null then
    select * into v_quote from public.shipping_quotes where id = p_quote_id;
    if not found then
      raise exception 'Cotação de frete inválida';
    end if;
    if v_quote.created_at < now() - interval '60 minutes' then
      raise exception 'Cotação de frete expirada. Recalcule o frete.';
    end if;
    -- os itens do pedido devem bater exatamente com os da cotação
    if exists (
      select 1 from (
        select (i->>'product_id')::uuid pid, sum((i->>'quantity')::int) q
          from jsonb_array_elements(p_items) i group by 1
      ) a
      full join (
        select (i->>'product_id')::uuid pid, sum((i->>'quantity')::int) q
          from jsonb_array_elements(v_quote.items) i group by 1
      ) b on a.pid = b.pid
      where a.pid is null or b.pid is null or a.q is distinct from b.q
    ) then
      raise exception 'Itens divergem da cotação de frete. Recalcule o frete.';
    end if;
    v_ship_total   := v_quote.price;
    v_ship_method  := v_quote.method;
    v_ship_service := v_quote.service;
    v_ship_days    := v_quote.delivery_days;
  else
    -- caminho legado (transitório): ao menos rejeita frete negativo
    if p_shipping_total is null or p_shipping_total < 0 then
      raise exception 'Frete inválido';
    end if;
    v_ship_total   := p_shipping_total;
    v_ship_method  := p_shipping_method;
    v_ship_service := p_shipping_service;
    v_ship_days    := p_shipping_days;
  end if;

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

  -- cria o pedido (usa os valores de frete autoritativos)
  insert into public.orders (
    user_id, subtotal, discount_total, shipping_total, grand_total,
    coupon_id, shipping_address, shipping_method, shipping_service,
    shipping_days, customer_email, customer_phone
  ) values (
    auth.uid(), v_subtotal, v_discount, v_ship_total,
    v_subtotal - v_discount + v_ship_total,
    v_coupon_id, p_shipping_address, v_ship_method, v_ship_service,
    v_ship_days, p_customer_email, p_customer_phone
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
