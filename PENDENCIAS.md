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

## 🟡 Melhorias planejadas

- [ ] **E-mail transacional** (Resend) — enviar automaticamente:
  - Pedido recebido · Pagamento confirmado · Pedido enviado (com rastreio)
  - Precisa: conta Resend + `RESEND_API_KEY` + verificar domínio de envio
  - Montar templates com a marca e disparo no webhook / mudança de status

- [ ] **Correios (frete real)** — hoje é **estimativa por região** (o webservice
  público foi descontinuado). Quando tiver contrato Correios (ou Melhor Envio),
  plugar o carrier real em `apps/api/src/services/shipping.ts` (arquitetura já pronta)

- [ ] **SSR (Angular Universal)** — renderização no servidor para SEO/performance
  máximos (as meta tags dinâmicas já cobrem o essencial)

- [ ] **Ícones PWA em PNG** — hoje é `icon.svg`; alguns dispositivos preferem
  PNG 192×192 e 512×512 (gerar versões quadradas da marca)

- [ ] **Favicon** — trocar o `favicon.ico` padrão do Angular por um da marca

## 🟢 Pós-deploy / infraestrutura

- [ ] **Domínio próprio** na Vercel → atualizar `APP_BASE_URL` e a linha `Sitemap:`
  em `apps/web/public/robots.txt`
- [ ] **Personalizar e-mails do Supabase Auth** (confirmação/recuperação) com a marca
- [ ] **Revisão final** de segurança, acessibilidade e performance (Lighthouse)
- [ ] **Testes automatizados** (unitários/e2e) — ainda não há cobertura
- [ ] (Precaução) Rotacionar a senha do banco — um script temporário chegou a
  contê-la localmente antes de ser removido do commit (não foi publicado)
