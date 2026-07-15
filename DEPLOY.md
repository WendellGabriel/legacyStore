# Deploy — legacyStore (Vercel + Supabase)

O projeto sobe como **um único projeto na Vercel**: o Angular vira site estático
e o Hono (`apps/api`) vira **Serverless Functions** em `/api/*` (mesmo domínio —
por isso o front chama `/api` relativo, sem CORS).

## 1. Importar na Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New → Project**
2. Importe o repositório **WendellGabriel/legacyStore**
3. A Vercel lê o `vercel.json` da raiz automaticamente:
   - Build: `pnpm --filter web build`
   - Output: `apps/web/dist/web/browser`
   - Funções: `api/[[...route]].ts` → app Hono
4. **NÃO precisa** mudar Root Directory (deixe na raiz)

## 2. Variáveis de ambiente (Project Settings → Environment Variables)

Adicione (marque para Production, Preview e Development):

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | `https://oratzgtadilcozstexec.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | sua service_role key (secreta) |
| `MP_ACCESS_TOKEN` | token do Mercado Pago (deixe vazio p/ modo dev) |
| `APP_BASE_URL` | a URL final do site (ex.: `https://legacystore.vercel.app`) |

> As chaves **públicas** do Supabase já estão no `environment.ts` do Angular.
> A `service_role` e o `MP_ACCESS_TOKEN` são secretas — só na Vercel.

## 3. Deploy

Clique **Deploy**. Ao terminar, anote a URL (ex.: `legacystore.vercel.app`) e:
- Atualize `APP_BASE_URL` (passo 2) com essa URL e **redeploy**
- Atualize a linha `Sitemap:` em `apps/web/public/robots.txt` com o domínio

## 4. Edge Function do webhook (Mercado Pago)

No terminal, com o [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref oratzgtadilcozstexec
supabase functions deploy payments-webhook --no-verify-jwt
supabase secrets set MP_ACCESS_TOKEN=seu_token_mp
```

URL do webhook: `https://oratzgtadilcozstexec.supabase.co/functions/v1/payments-webhook`

## 5. Mercado Pago

Em [mercadopago.com.br → Suas integrações](https://www.mercadopago.com.br/developers):
- Crie uma aplicação, pegue o **Access Token** (use o de **teste/sandbox** primeiro)
- Configure a **URL de notificação (webhook)** para a URL do passo 4
- Coloque o token em `MP_ACCESS_TOKEN` (Vercel + Supabase secret) e redeploy

Sem `MP_ACCESS_TOKEN`, o checkout roda em **modo dev** (botão "simular pagamento").

## 6. Pós-deploy (checklist)

- [ ] Site abre e a home carrega produtos
- [ ] `/api/health` responde `{ ok: true }`
- [ ] Login/cadastro funcionam
- [ ] Checkout calcula frete e cria pedido
- [ ] `/admin` abre com a conta admin
- [ ] Webhook confirma pagamento (teste com cartão de teste do MP)

## Rodar localmente (2 servidores)

No Windows, o espaço em "Claude Projects" quebra os atalhos do pnpm/ng —
chame o `node` direto:

```bash
# Terminal 1 — API Hono (porta 3000)
cd apps/api
node --env-file=../../.env ../../node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs src/server.ts

# Terminal 2 — Angular (porta 4200, com proxy /api → 3000)
cd apps/web
node ../../node_modules/@angular/cli/bin/ng.js serve
```

Em ambientes sem espaço no caminho, `pnpm start` em cada app também funciona.
