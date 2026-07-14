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
