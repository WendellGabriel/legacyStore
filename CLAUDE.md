# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório.

## Visão geral

`legacyStore` é um monorepo (pnpm workspaces): e-commerce profissional de TCG
(card games — Pokémon, Magic, Yu-Gi-Oh, One Piece etc.), venda de boxes e
produtos avulsos, com painel administrativo completo.

- **Frontend:** Angular v22 em `apps/web` (standalone, Signals, SCSS + Tailwind,
  Angular Material 3; SSR + PWA a configurar).
- **Backend:** `apps/api` — **Hono** (Vercel Functions). Webhook do Mercado Pago
  fica numa **Supabase Edge Function** (`supabase/functions`), colada ao banco.
- **Compartilhado:** `packages/shared` (`@legacystore/shared`) — tipos de domínio
  (`types/`), constantes/enums (`constants/`) e schemas Zod (`schemas/`) usados por
  front e back. Fonte única de verdade; não duplique interfaces.
- **Banco/Auth:** Supabase (Postgres + Auth + Storage + RLS). Schema versionado em
  `supabase/migrations/` (0001–0010) + `seed.sql`. RLS em todas as tabelas;
  criação de pedido via RPC atômica `create_order()` (impede overselling).
- **Deploy:** Vercel (frontend + Hono).

## Decisões de produto confirmadas

- **Guest cart** habilitado (carrinho por `session_id`, converte no checkout).
- **Multi-jogo** desde o lançamento (categorias-raiz por jogo, `categories.parent_id`).
- **Frete:** zonas personalizadas RM Recife (`shipping_zones`) + API Correios p/ resto do BR.
- Pagamento: Mercado Pago (PIX/cartão). Integrações previstas: WhatsApp, e-mail,
  Google Analytics, Meta Pixel.

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

## Estado atual (Fase 0 — Fundação)

Pronto: monorepo, Angular 22 scaffold, `packages/shared` (types+constants+Zod,
typecheck OK), banco 100% modelado em `supabase/` (migrations + RLS + RPCs + seed).

Aplicar o banco: colar `supabase/_apply_all.sql` no SQL Editor do Supabase.

Falta: `apps/api` (Hono), wiring do SupabaseClient no Angular, shell/layout +
tema claro/escuro + design system, SSR/PWA. Desenvolvimento por fases (0→8),
usuário aprova antes de cada módulo.
