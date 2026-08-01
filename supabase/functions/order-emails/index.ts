// Edge Function (Deno) — e-mails transacionais do pedido.
//
// Recebe:
//   (a) o payload de um Database Webhook do Supabase (INSERT/UPDATE em orders), ou
//   (b) um payload manual { order_number, event } (reenvio/teste).
// Determina o evento (created/paid/shipped), carrega o pedido + itens (service_role)
// e envia o e-mail via Resend.
//
// Degrada suavemente: sem RESEND_API_KEY, é um no-op (retorna 200) — nada quebra.
//
// Deploy:  supabase functions deploy order-emails --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="legacyStore <pedidos@seudominio.com>" APP_BASE_URL=https://...
//          (opcional) ORDER_EMAILS_SECRET=... para validar o header do webhook
//          (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente)

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  type OrderEmailData,
  type OrderEmailEvent,
  renderOrderEmail,
} from './templates.ts';
import { deriveEvent } from './logic.ts';

const RESEND_API = 'https://api.resend.com/emails';

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** Lê uma configuração de store_settings (jsonb) como string. */
async function setting(db: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await db.from('store_settings').select('value').eq('key', key).maybeSingle();
  const v = (data as { value?: unknown } | null)?.value;
  return typeof v === 'string' ? v : v == null ? null : String(v);
}

/** Carrega o pedido + itens no formato do template. */
async function loadOrder(
  db: SupabaseClient,
  orderNumber: string,
): Promise<{ data: OrderEmailData; email: string } | null> {
  const { data: order } = await db
    .from('orders')
    .select(
      'id, user_id, order_number, customer_email, subtotal, discount_total, shipping_total, grand_total, shipping_service, shipping_days, tracking_code, shipping_address',
    )
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (!order) return null;

  // e-mail: prioriza o snapshot do pedido; cai para o e-mail do perfil (auth)
  let email = (order as { customer_email?: string | null }).customer_email ?? '';
  if (!email) {
    const uid = (order as { user_id?: string | null }).user_id;
    if (uid) {
      const { data: u } = await db.auth.admin.getUserById(uid);
      email = u?.user?.email ?? '';
    }
  }
  if (!email) return null;

  const { data: items } = await db
    .from('order_items')
    .select('name_snapshot, unit_price, quantity, line_total')
    .eq('order_id', (order as { id: string }).id);

  const addr = (order as { shipping_address?: Record<string, unknown> | null }).shipping_address ?? {};
  const customerName =
    (addr?.['name'] as string | undefined) ??
    (addr?.['recipient'] as string | undefined) ??
    null;

  const o = order as Record<string, unknown>;
  const data: OrderEmailData = {
    order_number: o.order_number as string,
    customer_name: customerName,
    subtotal: Number(o.subtotal ?? 0),
    discount_total: Number(o.discount_total ?? 0),
    shipping_total: Number(o.shipping_total ?? 0),
    grand_total: Number(o.grand_total ?? 0),
    shipping_service: (o.shipping_service as string | null) ?? null,
    shipping_days: o.shipping_days != null ? Number(o.shipping_days) : null,
    tracking_code: (o.tracking_code as string | null) ?? null,
    items: (items ?? []).map((it) => {
      const r = it as Record<string, unknown>;
      return {
        name: r.name_snapshot as string,
        quantity: Number(r.quantity ?? 0),
        unit_price: Number(r.unit_price ?? 0),
        line_total: Number(r.line_total ?? 0),
      };
    }),
  };
  return { data, email };
}

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.error('resend error:', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    // Validação opcional de segredo do webhook (defesa em profundidade).
    const secret = Deno.env.get('ORDER_EMAILS_SECRET');
    if (secret) {
      const got = req.headers.get('x-webhook-secret') ?? req.headers.get('x-order-emails-secret');
      if (got !== secret) return new Response('não autorizado', { status: 401 });
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const body = await req.json().catch(() => null);
    if (!body) return new Response('payload inválido', { status: 200 });

    // Modo (a) Database Webhook  vs  (b) manual { order_number, event }
    let event: OrderEmailEvent | null;
    let orderNumber: string | undefined;

    if (typeof body.order_number === 'string' && typeof body.event === 'string') {
      event = ['created', 'paid', 'shipped'].includes(body.event) ? (body.event as OrderEmailEvent) : null;
      orderNumber = body.order_number;
    } else if (body.table === 'orders' && typeof body.type === 'string') {
      event = deriveEvent(body.type, body.record ?? null, body.old_record ?? null);
      orderNumber = body.record?.order_number;
    } else {
      return new Response('payload não reconhecido', { status: 200 });
    }

    if (!event || !orderNumber) return new Response('sem evento', { status: 200 });

    // Sem chave Resend → no-op silencioso (não quebra o fluxo do pedido).
    if (!apiKey) {
      console.log(`[order-emails] RESEND_API_KEY ausente — pulando ${event} de ${orderNumber}`);
      return new Response('resend não configurado', { status: 200 });
    }

    const db = admin();
    const loaded = await loadOrder(db, orderNumber);
    if (!loaded) return new Response('pedido/e-mail não encontrado', { status: 200 });

    const storeName = (await setting(db, 'store_name')) || 'legacyStore';
    const from =
      Deno.env.get('EMAIL_FROM') || `${storeName} <onboarding@resend.dev>`;
    const baseUrl =
      Deno.env.get('APP_BASE_URL') ||
      (await setting(db, 'app_base_url')) ||
      'https://legacy-store-web.vercel.app';

    const { subject, html, text } = renderOrderEmail(event, loaded.data, { storeName, baseUrl });
    const ok = await sendViaResend(apiKey, from, loaded.email, subject, html, text);

    return new Response(ok ? 'ok' : 'falha no envio', { status: ok ? 200 : 502 });
  } catch (e) {
    console.error('order-emails error:', (e as Error).message);
    return new Response('erro interno', { status: 500 });
  }
});
