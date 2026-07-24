# Pendências — legacyStore

Itens a configurar/construir **após o lançamento** (o site já é funcional sem eles).

## 🔴 Necessário para operar de verdade

- [ ] **Mercado Pago (pagamento real)**
  - Criar aplicação em mercadopago.com.br → pegar **Access Token** (sandbox → depois produção)
  - Definir `MP_ACCESS_TOKEN` na Vercel e como secret do Supabase
  - Configurar a **URL de notificação (webhook)** apontando para a Edge Function
  - Sem isso, o checkout roda em **modo dev** (botão "simular pagamento")

- [ ] **Edge Function do webhook** — deploy via Supabase CLI
  (`supabase functions deploy payments-webhook --no-verify-jwt`) + `supabase secrets set MP_ACCESS_TOKEN=...`

- [ ] **Preencher `store_settings`** (via Admin ou SQL): WhatsApp real, `ga_measurement_id`
  (Google Analytics), `meta_pixel_id`, `origin_cep` (CEP da loja), `free_shipping_threshold`

- [ ] **Resend (SMTP dos e-mails de autenticação)** — o e-mail embutido do Supabase
  é só para testes (limite ~2-4/hora e cai em spam), o que **quebra o reset de senha**
  em produção. Configurar SMTP próprio:
  - Criar conta em [resend.com](https://resend.com) (grátis até 3k/mês) → **API key** + verificar domínio
  - Supabase → **Authentication → SMTP Settings** → preencher com os dados do Resend
  - Resolve: reset de senha, confirmação de cadastro e demais e-mails de auth
  - Mesma conta Resend serve para o **e-mail transacional** (abaixo)
  - Contexto: o bug do link de reset (localhost / rota errada) JÁ foi corrigido
    (commit 9ca8035); o que falta é sair do e-mail embutido limitado
  - Workaround imediato p/ redefinir senha sem e-mail: `apps/api/_setpass.mjs`

## 🟡 Melhorias planejadas

- [x] ~~**Alterar senha pelo perfil**~~ ✅ FEITO — card "Alterar senha" em
  `/conta/perfil` (confirma a senha atual revalidando as credenciais e aplica a nova
  via `supabase.auth.updateUser`). `AuthService.changePassword()`.

- [x] ~~**Copiar/Duplicar produto no admin**~~ ✅ FEITO — botão de duplicar na lista
  de produtos: clona como **rascunho inativo** (estoque 0, SKU/slug novos, imagens
  copiadas) e abre o form do rascunho. `AdminService.duplicateProduct()`.

- [x] **Pré-venda / lista de interesse (waitlist)** — ✅ FEITO (código). Migration
  `0013_preorder_waitlist.sql` criada. **AÇÃO DO USUÁRIO:** aplicar
  `supabase/_apply_preorder.sql` no SQL Editor do Supabase (cria a coluna
  `products.allow_preorder`, a tabela `product_waitlist` com RLS, e o setting
  `auto_preorder_on_zero`). Sem isso, o front não mostra o estado de pré-venda.
  Implementado: flag por produto no form do admin ("Pré-venda ao esgotar"), toggle
  global em `/admin/pre-venda`, badge + botão "Tenho interesse / avise-me" com modal
  na PDP, badge "Pré-venda" no card, e a página admin com lista de interessados por
  produto + exportar CSV + marcar avisado. Detalhes originais abaixo:

  Quando um produto zera o
  estoque, em vez de sair do ar ele entra em **pré-venda**, e o cliente pode
  **manifestar interesse** deixando seu contato. Isso monta, para o admin, uma
  **lista de interessados por produto** — usada para dimensionar melhor a recompra.
  - **Escopo (decidido): apenas LISTA DE AVISO por enquanto** — não vende nem cobra
    antecipado em pré-venda; só coleta o interesse do cliente. (Pré-venda com compra
    antecipada fica como evolução futura.)
  - **Controle pelo admin (decidido):** dois modos, combináveis —
    (a) **automático:** ao zerar o estoque o produto entra em pré-venda sozinho
    (flag global em `store_settings`, ex. `auto_preorder_on_zero`); e
    (b) **manual:** o admin marca/desmarca por produto (flag `allow_preorder` no
    produto), que tem prioridade sobre o automático.
  - **Banco:** nova tabela `product_waitlist` (`product_id`, `user_id` nullable +
    `email`/`whatsapp` para guest, `created_at`, `notified_at` nullable, unique por
    produto+contato p/ evitar duplicidade). RLS: insert público/anon, select só admin.
    + coluna `products.allow_preorder` (bool) e setting `auto_preorder_on_zero`.
  - **Estado do produto:** "pré-venda" = produto **esgotado** (`stock <= 0`) **E**
    (`allow_preorder` do produto **ou** `auto_preorder_on_zero` ligado). Nesse estado
    o produto continua listável em vez de aparecer como indisponível.
  - **Frontend (PDP + ProductCard):** quando em pré-venda, trocar "Adicionar ao
    carrinho" por **"Tenho interesse / avise-me"** (badge "Pré-venda"). Modal simples
    coletando e-mail/WhatsApp (autopreenche se logado) → grava em `product_waitlist`.
  - **Admin:** toggle de pré-venda no form do produto + a flag global nas configurações;
    listagem de interessados por produto (contagem + export/CSV) para priorizar
    reestoque. Opcional: ao repor estoque, marcar `notified_at` e disparar aviso
    (encaixa no **e-mail transacional**/WhatsApp — mesma infra Resend).

- [ ] **E-mail transacional** (Resend — mesma conta do SMTP acima) — enviar automaticamente:
  - Pedido recebido · Pagamento confirmado · Pedido enviado (com rastreio)
  - Precisa: `RESEND_API_KEY` + domínio verificado
  - Montar templates com a marca e disparo no webhook / mudança de status

- [ ] **Correios (frete real)** — hoje é **estimativa por região** (o webservice
  público foi descontinuado). Quando tiver contrato Correios (ou Melhor Envio),
  plugar o carrier real em `apps/api/src/services/shipping.ts` (arquitetura já pronta)

- [ ] **SSR / Prerender (Angular)** — ADIADO (decisão 2026-07-24). Ganho é
  incremental (o `SeoService` já injeta title/OG/descrição por página). **Pré-requisito
  descoberto:** o app é SPA puro — há ~31 acessos a `localStorage`/`window`/`document`
  (tema, carrinho, wishlist, auth, analytics, carrossel), vários no construtor de
  serviços do shell. Prerender roda os componentes no Node → quebra até tudo virar
  **SSR-safe** (guardar com `isPlatformBrowser(inject(PLATFORM_ID))`) + tratar
  hydration mismatch (ex.: classe de tema no `<html>`). Só então: `@angular/ssr`,
  `main.server.ts`, `app.config.server.ts`, `app.routes.server.ts` (home+produtos =
  `RenderMode.Prerender`, resto `Client`), `outputMode: static` no angular.json.
  Deploy segue estático (compatível com o vercel.json atual). Mexe em prod que já
  funciona — fazer com verificação exaustiva local antes de qualquer push.

- [ ] **Ícones PWA em PNG** — hoje é `icon.svg`; alguns dispositivos preferem
  PNG 192×192 e 512×512 (gerar versões quadradas da marca)

- [ ] **Favicon** — trocar o `favicon.ico` padrão do Angular por um da marca

## 🔒 Segurança (overview da aplicação)

- [x] **Overview de segurança** — ✅ RELATÓRIO GERADO em `SECURITY.md` (2026-07-23).
  Principal achado (🔴): total do pedido manipulável (frete `p_shipping_total` vindo
  do cliente no `create_order`). Faltam as CORREÇÕES (A1/M1/M2/B4). Detalhes abaixo:
  varredura completa da aplicação, produzindo um
  relatório com achados classificados por severidade (crítico/alto/médio/baixo) e
  correções. Cobrir, no mínimo:
  - **RLS (Postgres):** revisar as policies de **todas** as tabelas — garantir que
    `select/insert/update/delete` só permitem o que deve; conferir que dados de um
    cliente não vazam para outro; que `product_waitlist`/`addresses`/`orders` só são
    lidos pelo dono ou admin; e que não há tabela com RLS desligado por engano.
  - **RPCs `SECURITY DEFINER`** (`create_order`, `validate_coupon`, `adjust_stock`,
    `admin_dashboard_stats`, `is_admin`): confirmar `search_path` fixo, checagem de
    permissão dentro da função e que não dá para abusar (ex.: forjar preço/quantidade,
    aplicar cupom indevido, ajustar estoque sem ser admin).
  - **Webhook Mercado Pago:** validar a **assinatura** da notificação (header
    `x-signature`) e reconsultar o pagamento no MP antes de marcar como pago — não
    confiar no corpo recebido. Conferir idempotência (unique `provider_payment_id`).
  - **Segredos/env:** confirmar que `SERVICE_ROLE`/`DATABASE_URL`/`MP_ACCESS_TOKEN`
    nunca vão para o bundle do front (só `NG_APP_*`/anon key são públicas); `.env`
    fora do git; secrets só no Supabase/Vercel. Rever histórico por vazamentos.
  - **Supabase Storage:** bucket `products` é público para leitura, mas escrita só
    admin — confirmar policies de upload/delete e limites de tipo/tamanho de arquivo.
  - **Validação de entrada:** garantir que toda rota da API e RPC valida payload
    (Zod/checagens) — CEP, cupom, quantidades, IDs — contra injeção e valores fora
    de faixa. Conferir CORS da Edge Function (origens permitidas).
  - **Auth:** políticas de senha, fluxo de reset, expiração de sessão/JWT, e o
    `adminGuard` (garantir que rotas `/admin` e ações de escrita exigem admin de fato,
    não só ocultam o menu).
  - **Cabeçalhos/headers:** avaliar CSP, HSTS, `X-Content-Type-Options`,
    `X-Frame-Options`/frame-ancestors, `Referrer-Policy` no front (Vercel) e API.
  - **Dependências:** rodar auditoria (`pnpm audit`) e revisar libs desatualizadas.
  - Rodar também o `/security-review` do Claude Code sobre o diff/base para achados
    automáticos, e consolidar tudo num `SECURITY.md` com o status de cada item.

## 🟢 Pós-deploy / infraestrutura

- [ ] **Domínio próprio** na Vercel → atualizar `APP_BASE_URL` e a linha `Sitemap:`
  em `apps/web/public/robots.txt`
- [ ] **Personalizar e-mails do Supabase Auth** (confirmação/recuperação) com a marca
- [ ] **Revisão final** de segurança, acessibilidade e performance (Lighthouse)
- [~] **Testes automatizados** — em andamento. Dois runners:
  - `pnpm test` (Vitest, raiz) → 37 testes: `packages/shared` (isPreorder, schemas
    Zod, constantes) + `supabase/functions/store-api/lib.ts` (frete, validação).
  - `ng test` em `apps/web` (Vitest+jsdom, via TestBed) → 67 testes. Services:
    Cart, Wishlist, RecentlyViewed, Address(lookupCep), Catalog(filtro→query),
    Order(tradução de erros), Waitlist(dedupe), Settings, AdminService.duplicateProduct.
    Componentes/pipes: `ProductCard` (badges pré-venda/esgotado/desconto + add),
    `Carousel` (índice circular + navegação), `BrlPipe`. Mocks em `src/testing/`.
  Total: ~104 testes. Falta: mais componentes (checkout/PDP), e2e do checkout
- [ ] (Precaução) Rotacionar a senha do banco — um script temporário chegou a
  contê-la localmente antes de ser removido do commit (não foi publicado)
