# Overview de Segurança — legacyStore

Auditoria de código (RLS, RPCs, webhook do Mercado Pago, Edge Functions, guards,
segredos, Storage). Achados classificados por severidade, com correção sugerida.
Data: 2026-07-23.

> Legenda: 🔴 alto · 🟠 médio · 🟡 baixo · 🟢 ok (defesa já presente)

## Status das correções (2026-07-23)

Corrigido no código (aguardando **deploy** — ver instruções ao final):
- ✅ **A1** — frete autoritativo via `shipping_quotes` + `create_order` valida a
  cotação (migration `0014`). Ignora o `p_shipping_total` do cliente.
- ✅ **M2** — webhook compara valor pago × `grand_total` antes de aprovar.
- ✅ **M1** — webhook valida assinatura `x-signature` (ativa quando
  `MP_WEBHOOK_SECRET` estiver setado; degrada suave até lá).
- ✅ **M3** — CORS da Edge Function restrito à origem do site.
- ✅ **B4** — headers de segurança no `vercel.json`.

Pendentes (não implementados): **B1, B2, B3** e itens de infraestrutura.

### Deploy necessário para valer em produção
1. **SQL Editor:** rodar `supabase/_apply_security.sql` (migration 0014 — cria
   `shipping_quotes` e atualiza `create_order`).
2. **Redeploy das Edge Functions:**
   `npx supabase functions deploy store-api --no-verify-jwt`
   `npx supabase functions deploy payments-webhook --no-verify-jwt`
3. **Push** do frontend (a Vercel builda sozinha).
4. **(M1, opcional)** setar o segredo do webhook do MP:
   `npx supabase secrets set MP_WEBHOOK_SECRET=<secret do painel do MP>`

---

## 🔴 Alto

### A1. Total do pedido manipulável — frete controlado pelo cliente
`create_order()` (`supabase/migrations/0009_rpc_orders.sql`) calcula o **subtotal
com os preços do banco** (bom), mas recebe `p_shipping_total` **direto do cliente**
(`apps/web/.../account/order.service.ts` → `p_shipping_total: params.shipping.price`)
e usa esse valor no `grand_total` sem revalidar. Não há sequer `check >= 0`.

**Impacto:** um atacante chama o RPC diretamente (tem a anon key) com
`p_shipping_total = 0` ou **negativo**, reduzindo o total do pedido. Como a
preferência do Mercado Pago é montada no servidor a partir do pedido
(`store-api` → `createPreference`), a **cobrança sai menor** que o devido.

**Correção:**
- Recalcular o frete **dentro do servidor** no momento de criar o pedido (mover a
  criação do pedido para uma Edge Function que chama a mesma lógica de
  `calculateShipping`, ou uma RPC que recompute a cotação), em vez de confiar no
  valor recebido.
- No mínimo imediato: `check (p_shipping_total >= 0)` e limitar quantidade máxima
  por item; idealmente comparar o `p_shipping_total` contra uma cotação recomputada
  para o CEP/itens e rejeitar divergências.

---

## 🟠 Médio

### M1. Webhook do Mercado Pago não valida a assinatura `x-signature`
`payments-webhook/index.ts` não valida o header `x-signature`/`x-request-id`
(HMAC) das notificações. **Mitigado** porque o webhook **reconsulta o pagamento na
API do MP** com o access token antes de confiar (🟢), então forjar um "approved" é
difícil. Ainda assim é defesa em profundidade recomendada pela doc do MP.

**Correção:** validar o HMAC do `x-signature` (ts + id) com uma chave secreta do MP
antes de processar; descartar notificações inválidas.

### M2. Webhook não confere valor pago × total do pedido
O webhook atualiza o pedido para `paid` sem comparar `payment.transaction_amount`
com o `grand_total` esperado. Combinado com **A1**, permite pagar a menos e ainda
assim o pedido virar "pago".

**Correção:** ao aprovar, comparar `transaction_amount` com o total esperado do
pedido (com tolerância de centavos). Se divergir, marcar para revisão manual em vez
de `paid`.

### M3. CORS liberado para qualquer origem na Edge Function
`store-api` usa `app.use('*', cors())` → `Access-Control-Allow-Origin: *`, inclusive
em rotas que mutam (`/payments/*`). Risco baixo hoje (não usa cookies/sessão do
navegador), mas é superfície desnecessária.

**Correção:** restringir o CORS à origem do site (`APP_BASE_URL`) e aos métodos
usados.

---

## 🟡 Baixo

### B1. `/payments/dev-confirm` protegido só por ausência de token
A rota que marca um pedido como pago sem pagamento real só é bloqueada por
`mpConfigured()` (403 quando há `MP_ACCESS_TOKEN`). Em produção está desativada,
mas se o token for removido/expirar, **qualquer um marca qualquer pedido como pago**
sabendo o `order_number`.

**Correção:** exigir também um segredo (header) ou remover a rota do build de
produção.

### B2. Vazamento de mensagem de erro
`/payments/checkout` e o webhook retornam `(e as Error).message` cru (inclui o texto
de erro do MP). Preferir logar server-side e responder mensagem genérica.

### B3. Validação de entrada superficial na Edge Function
`store-api` valida apenas presença de campos. Os schemas Zod de `packages/shared`
não são reaproveitados (a function Deno é standalone). Validar `cep`, `items`,
`quantity` (inteiro > 0, teto) com Zod reduz entradas maliciosas/absurdas.

### B4. Headers de segurança ausentes
`vercel.json` não define CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`/
`frame-ancestors`, `Referrer-Policy`.

**Correção:** adicionar `headers` no `vercel.json` (ao menos
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY` e uma CSP básica).

---

## 🟢 O que já está correto (não mexer)

- **RLS habilitado em todas as tabelas** (`0010_rls_policies.sql`) com policies
  coerentes: catálogo público lê só o ativo; `orders`/`addresses`/`payments`/
  `product_waitlist` só o dono (`auth.uid()`) ou admin.
- **Sem vazamento de segredo no frontend:** o bundle usa apenas a *publishable/anon
  key*; `service_role`/`DATABASE_URL`/`MP_ACCESS_TOKEN` ficam no backend. `.env` e
  scripts `_*.mjs` estão no `.gitignore`.
- **`create_order` é robusto no essencial:** subtotal calculado com preços do banco
  (não confia no preço do cliente), `FOR UPDATE` evita corrida/overselling, cupom
  validado server-side via `validate_coupon`. Pedidos só são criados via este RPC
  (não há policy de INSERT direto em `orders`).
- **Webhook reconsulta o pagamento no MP** (não confia no corpo recebido) e é
  **idempotente** (unique `provider_payment_id`, migration 0011).
- **`adminGuard` confere a role no banco** (não apenas esconde o menu); RLS impede
  ler o perfil de outro usuário.
- **RPCs são `SECURITY DEFINER` com `search_path = public` fixo** (`is_admin`,
  `create_order`, `validate_coupon`, `admin_dashboard_stats`), evitando sequestro de
  `search_path`.

---

## Itens de infraestrutura / processo (fora do código)

- [ ] **`pnpm audit`** — rodar auditoria de dependências e atualizar libs vulneráveis.
- [ ] **Rotacionar a senha do banco** — um script temporário chegou a contê-la
  localmente antes de ser removido do commit (ver `PENDENCIAS.md`).
- [ ] **Testes automatizados** — sem cobertura; ao menos testar `create_order`,
  `validate_coupon` e o fluxo do webhook.
- [ ] **Personalizar/limitar e-mails de auth** e configurar SMTP próprio (Resend) —
  já em `PENDENCIAS.md`.

---

## Prioridade sugerida de correção

1. **A1** (total manipulável) — maior impacto financeiro direto.
2. **M2** (valor pago × pedido) — fecha o buraco do A1 no lado do pagamento.
3. **M1** (assinatura do webhook) e **B4** (headers) — endurecimento.
4. Demais itens conforme disponibilidade.
