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
