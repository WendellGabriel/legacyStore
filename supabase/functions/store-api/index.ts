// Edge Function (Deno) — API pública da loja: frete, pagamento e sitemap.
// Substitui a function da Vercel (incompatível com o monorepo pnpm).
//
// Deploy:  supabase functions deploy store-api --no-verify-jwt
// Secrets: supabase secrets set MP_ACCESS_TOKEN=... APP_BASE_URL=https://...
//          (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente)
//
// O frontend chama /api/* e a Vercel reescreve para
// https://<ref>.supabase.co/functions/v1/store-api/*

import { Hono } from 'jsr:@hono/hono';
import { cors } from 'jsr:@hono/hono/cors';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const MP_API = 'https://api.mercadopago.com';

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

function mpConfigured(): boolean {
  return !!Deno.env.get('MP_ACCESS_TOKEN');
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ---- CEP (ViaCEP) --------------------------------------------------
async function lookupCep(rawCep: string) {
  const cep = rawCep.replace(/\D/g, '');
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.erro || !d.localidade || !d.uf) return null;
    return { cep, neighborhood: d.bairro || null, city: d.localidade, state: d.uf };
  } catch {
    return null;
  }
}

// ---- Frete ---------------------------------------------------------
const REGION_TABLE: Record<string, { pac: [number, number, number]; sedex: [number, number, number] }> = {
  NE: { pac: [22, 4, 5], sedex: [38, 6, 2] },
  SE: { pac: [28, 5, 7], sedex: [46, 8, 3] },
  SCO: { pac: [32, 6, 9], sedex: [54, 9, 4] },
  N: { pac: [42, 8, 12], sedex: [72, 12, 6] },
};
const UF_REGION: Record<string, keyof typeof REGION_TABLE> = {
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'SCO', RS: 'SCO', SC: 'SCO', DF: 'SCO', GO: 'SCO', MT: 'SCO', MS: 'SCO',
  AC: 'N', AM: 'N', AP: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
};

function estimate([base, perKg]: [number, number, number], kg: number): number {
  const extra = Math.max(0, Math.ceil(kg) - 1);
  return Math.round((base + perKg * extra) * 100) / 100;
}

interface Quote {
  method: string;
  service: string;
  price: number;
  delivery_days: number;
  quote_id?: string | null;
}

/**
 * Persiste cada cotação em shipping_quotes (autoritativo) e devolve com quote_id.
 * O create_order lê o preço/prazo daí, ignorando qualquer valor do cliente (A1).
 */
async function persistQuotes(
  sb: SupabaseClient,
  cep: string,
  items: { product_id: string; quantity: number }[],
  quotes: Quote[],
): Promise<Quote[]> {
  for (const q of quotes) {
    const { data } = await sb
      .from('shipping_quotes')
      .insert({
        cep,
        items,
        method: q.method,
        service: q.service,
        price: q.price,
        delivery_days: q.delivery_days,
      })
      .select('id')
      .single();
    q.quote_id = (data as { id: string } | null)?.id ?? null;
  }
  return quotes;
}

async function calculateShipping(cep: string, items: { product_id: string; quantity: number }[]) {
  const info = await lookupCep(cep);
  if (!info) return { quotes: [], destination: null };
  const destination = `${info.city} - ${info.state}`;
  const sb = admin();

  if (info.neighborhood) {
    const { data: zones } = await sb.from('shipping_zones').select('*').eq('is_active', true);
    const match = (zones ?? []).find(
      (z: { city: string; neighborhood: string }) =>
        norm(z.city) === norm(info.city) && norm(z.neighborhood) === norm(info.neighborhood!),
    );
    if (match) {
      const quotes: Quote[] = [{
        method: 'recife_zone', service: 'Entrega local',
        price: Number(match.price), delivery_days: match.delivery_days,
      }];
      return { destination, quotes: await persistQuotes(sb, cep, items, quotes) };
    }
  }

  const region = UF_REGION[info.state];
  if (!region) return { quotes: [], destination };

  const ids = items.map((i) => i.product_id);
  const { data: prods } = await sb.from('products').select('id, weight_grams').in('id', ids);
  const weights = new Map((prods ?? []).map((p: { id: string; weight_grams: number | null }) => [p.id, p.weight_grams ?? 300]));
  const grams = items.reduce((s, i) => s + (weights.get(i.product_id) ?? 300) * i.quantity, 0);
  const kg = Math.max(grams, 300) / 1000;
  const t = REGION_TABLE[region];

  const quotes: Quote[] = [
    { method: 'correios', service: 'PAC', price: estimate(t.pac, kg), delivery_days: t.pac[2] },
    { method: 'correios', service: 'SEDEX', price: estimate(t.sedex, kg), delivery_days: t.sedex[2] },
  ];
  return { destination, quotes: await persistQuotes(sb, cep, items, quotes) };
}

// ---- Mercado Pago --------------------------------------------------
async function createPreference(order: {
  order_number: string;
  items: { name_snapshot: string; quantity: number; unit_price: number }[];
  shipping_total: number;
  discount_total: number;
  customer_email: string | null;
}) {
  const token = Deno.env.get('MP_ACCESS_TOKEN')!;
  const appBase = Deno.env.get('APP_BASE_URL') ?? 'https://legacy-store-web.vercel.app';
  const supaUrl = Deno.env.get('SUPABASE_URL')!;

  const items = order.items.map((i) => ({
    title: i.name_snapshot, quantity: i.quantity,
    unit_price: Math.round(Number(i.unit_price) * 100) / 100, currency_id: 'BRL',
  }));
  if (order.shipping_total > 0) items.push({ title: 'Frete', quantity: 1, unit_price: Number(order.shipping_total), currency_id: 'BRL' });
  if (order.discount_total > 0) items.push({ title: 'Desconto', quantity: 1, unit_price: -Number(order.discount_total), currency_id: 'BRL' });

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items,
      external_reference: order.order_number,
      payer: order.customer_email ? { email: order.customer_email } : undefined,
      back_urls: {
        success: `${appBase}/pedido/${order.order_number}?status=aprovado`,
        pending: `${appBase}/pedido/${order.order_number}?status=pendente`,
        failure: `${appBase}/pedido/${order.order_number}?status=recusado`,
      },
      auto_return: 'approved',
      notification_url: `${supaUrl}/functions/v1/payments-webhook`,
      statement_descriptor: 'LEGACYSTORE',
    }),
  });
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ---- App Hono ------------------------------------------------------
const app = new Hono().basePath('/store-api');

// CORS restrito à origem do site (+ localhost em dev). Endpoints não usam
// cookies/sessão do navegador, mas evitamos expor a API a qualquer origem.
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_BASE_URL') ?? 'https://legacy-store-web.vercel.app',
  'http://localhost:4200',
];
app.use(
  '*',
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
);

app.get('/health', (c) => c.json({ ok: true, service: 'legacystore-store-api' }));

app.post('/shipping/quote', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.cep || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: 'Dados inválidos' }, 400);
  }
  const result = await calculateShipping(body.cep, body.items);
  if (result.quotes.length === 0) {
    return c.json({ error: 'Não foi possível calcular o frete para este CEP.', ...result }, 422);
  }
  return c.json(result);
});

app.get('/payments/mode', (c) => c.json({ dev: !mpConfigured() }));

app.post('/payments/checkout', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.order_number) return c.json({ error: 'Dados inválidos' }, 400);

  const sb = admin();
  const { data: order } = await sb
    .from('orders').select('*, items:order_items(*)')
    .eq('order_number', body.order_number).maybeSingle();
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404);
  if (order.payment_status === 'approved') return c.json({ error: 'Pedido já foi pago' }, 409);
  if (!mpConfigured()) return c.json({ dev: true, message: 'Mercado Pago não configurado (modo dev).' });

  try {
    const pref = await createPreference(order);
    return c.json({ init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

app.post('/payments/dev-confirm', async (c) => {
  if (mpConfigured()) return c.json({ error: 'Indisponível: Mercado Pago configurado.' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body?.order_number) return c.json({ error: 'Dados inválidos' }, 400);

  const sb = admin();
  const { data: order } = await sb.from('orders').select('id').eq('order_number', body.order_number).maybeSingle();
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404);
  await sb.from('orders').update({ payment_status: 'approved', status: 'paid' }).eq('id', order.id);
  await sb.from('payments').insert({ order_id: order.id, provider: 'dev', method: 'manual', amount: 0, status: 'approved' });
  return c.json({ ok: true, status: 'paid' });
});

app.get('/sitemap.xml', async (c) => {
  const base = Deno.env.get('APP_BASE_URL') ?? 'https://legacy-store-web.vercel.app';
  const sb = admin();
  const [{ data: products }, { data: categories }] = await Promise.all([
    sb.from('products').select('slug, updated_at').eq('is_active', true),
    sb.from('categories').select('slug').eq('is_active', true),
  ]);
  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq></url>`,
    `<url><loc>${base}/produtos</loc><changefreq>daily</changefreq></url>`,
    ...(categories ?? []).map((cat: { slug: string }) => `<url><loc>${base}/c/${cat.slug}</loc><changefreq>weekly</changefreq></url>`),
    ...(products ?? []).map((p: { slug: string; updated_at: string }) => `<url><loc>${base}/p/${p.slug}</loc><lastmod>${p.updated_at?.slice(0, 10)}</lastmod></url>`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml' });
});

Deno.serve(app.fetch);
