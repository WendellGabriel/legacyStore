# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório.

## Visão geral

`legacyStore` é um monorepo (pnpm workspaces) para uma aplicação web profissional.

- **Frontend:** Angular v22 em `apps/web` (standalone components, SCSS, sem SSR).
- **Backend:** `apps/api` — **ainda não decidido** (Supabase-only / Hono / NestJS).
  Não crie o backend sem confirmar a escolha com o usuário.
- **Compartilhado:** `packages/shared` (`@legacystore/shared`) — tipos/DTOs
  usados por front e back. Coloque interfaces de domínio aqui, não duplique.
- **Banco/Auth:** Supabase (Postgres + Auth + Storage + RLS).
- **Deploy:** Vercel (frontend).

## Comandos

- `pnpm install` — instala tudo (rode na raiz).
- `pnpm dev:web` — sobe o Angular.
- `pnpm lint` / `pnpm format` — qualidade de código.
- Angular CLI: chame via `node node_modules/@angular/cli/bin/ng.js <cmd>`
  (o caminho do projeto tem espaço em "Claude Projects", o que quebra os
  shims do pnpm/npx no Windows — usar node direto é o contorno confiável).

## Convenções

- **Segredos:** nunca commitar `.env`. Apenas `.env.example` versionado.
  Chaves `NG_APP_*` são públicas; `SERVICE_ROLE`/`DATABASE_URL` são secretas.
- **Tipos compartilhados:** defina em `packages/shared` e importe via
  `@legacystore/shared` nos dois apps.
- **Plataforma:** ambiente Windows. Preferir caminhos absolutos.

## Estado atual

Fundação montada (monorepo, Angular, shared, tooling). Backend e o tipo de
aplicação ainda serão definidos pelo usuário antes da construção do site.
