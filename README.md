# legacyStore

Monorepo profissional com Angular + (backend a definir) + Supabase, deploy na Vercel.

## Estrutura

```
legacyStore/
├── apps/
│   ├── web/          # Frontend Angular (v22)
│   └── api/          # Backend (reservado — tecnologia a definir)
├── packages/
│   └── shared/       # Tipos TypeScript compartilhados (@legacystore/shared)
├── pnpm-workspace.yaml
└── .env.example      # Copie para .env e preencha (NUNCA commite .env)
```

## Pré-requisitos

- Node >= 20
- pnpm (`npm install -g pnpm`)

## Comandos

```bash
pnpm install          # instala todas as dependências do workspace
pnpm dev:web          # sobe o frontend Angular
pnpm lint             # lint em todos os pacotes
pnpm format           # formata o código com Prettier
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com as chaves do Supabase.
Chaves com prefixo `NG_APP_` são públicas (frontend). `SUPABASE_SERVICE_ROLE_KEY`
e `DATABASE_URL` são secretas — apenas backend.

## Deploy

- **Frontend:** Vercel (importar o repositório, root `apps/web`)
- **Supabase:** projeto criado no dashboard; conectar via variáveis de ambiente
