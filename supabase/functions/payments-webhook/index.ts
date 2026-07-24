// Edge Function (Deno): webhook do Mercado Pago.
// Recebe a notificação, consulta o pagamento na API do MP e atualiza o pedido.
// Roda colada ao banco (service_role) para máxima confiabilidade.
//
// Deploy:  supabase functions deploy payments-webhook --no-verify-jwt
// Segredo: supabase secrets set MP_ACCESS_TOKEN=... (SUPABASE_URL e
//          SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MP_API = 'https://api.mercadopago.com';

/**
 * Valida a assinatura HMAC do Mercado Pago (header x-signature).
 * Manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Retorna true se válida OU se o segredo não estiver configurado (degrada
 * suavemente — a reconsulta do pagamento no MP continua sendo a defesa principal).
 */
async function verifyMpSignature(req: Request, dataId: string | null): Promise<boolean> {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!secret) return true; // não configurado ainda → não bloqueia

  const sig = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');
  if (!sig || !dataId) return false;

  const parts = Object.fromEntries(
    sig.split(',').map((p) => p.split('=', 2).map((s) => s.trim()) as [string, string]),
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  // rejeita timestamps muito antigos (replay) — 10 min de tolerância
  const tsMs = Number(ts) * (ts.length <= 10 ? 1000 : 1);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId ?? ''};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // comparação em tempo constante
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!mpToken) return new Response('MP_ACCESS_TOKEN ausente', { status: 500 });

    // O MP envia o id do pagamento via query (?data.id=) ou no corpo.
    const url = new URL(req.url);
    let paymentId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
    let type = url.searchParams.get('type') ?? url.searchParams.get('topic');

    if (!paymentId) {
      const body = await req.json().catch(() => null);
      paymentId = body?.data?.id ?? null;
      type = body?.type ?? type;
    }

    // Valida a assinatura (defesa em profundidade; só bloqueia se o segredo existir)
    if (!(await verifyMpSignature(req, paymentId))) {
      return new Response('assinatura inválida', { status: 401 });
    }

    // Só tratamos notificações de pagamento
    if (type && type !== 'payment') return new Response('ignorado', { status: 200 });
    if (!paymentId) return new Response('sem payment id', { status: 200 });

    // Consulta o pagamento no MP
    const payRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    if (!payRes.ok) return new Response('falha ao consultar pagamento', { status: 200 });
    const payment = await payRes.json();

    const orderNumber: string | undefined = payment.external_reference;
    if (!orderNumber) return new Response('sem external_reference', { status: 200 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: order } = await supabase
      .from('orders')
      .select('id, grand_total')
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (!order) return new Response('pedido não encontrado', { status: 200 });

    // Mapeia status do MP → status do pedido
    const map: Record<string, { payment_status: string; status?: string }> = {
      approved: { payment_status: 'approved', status: 'paid' },
      pending: { payment_status: 'pending' },
      in_process: { payment_status: 'pending' },
      rejected: { payment_status: 'rejected' },
      cancelled: { payment_status: 'rejected', status: 'cancelled' },
      refunded: { payment_status: 'refunded', status: 'refunded' },
    };
    let mapped = map[payment.status] ?? { payment_status: 'pending' };

    // M2: confere o valor pago × total do pedido antes de aprovar.
    // Se divergir (além de 1 centavo de tolerância), NÃO marca como pago —
    // deixa pendente para revisão manual, evitando aprovação de valor menor.
    if (mapped.status === 'paid') {
      const paid = Number(payment.transaction_amount);
      const expected = Number(order.grand_total);
      if (!Number.isFinite(paid) || Math.abs(paid - expected) > 0.01) {
        console.warn(
          `Valor divergente no pedido ${orderNumber}: pago=${paid} esperado=${expected}`,
        );
        mapped = { payment_status: 'pending' };
      }
    }

    await supabase
      .from('orders')
      .update({
        payment_status: mapped.payment_status,
        ...(mapped.status ? { status: mapped.status } : {}),
        payment_method: payment.payment_method_id === 'pix' ? 'pix' : 'card',
      })
      .eq('id', order.id);

    // Registra/atualiza o pagamento
    await supabase.from('payments').upsert(
      {
        order_id: order.id,
        provider: 'mercadopago',
        method: payment.payment_method_id === 'pix' ? 'pix' : 'card',
        amount: payment.transaction_amount,
        status: mapped.payment_status,
        provider_payment_id: String(paymentId),
        raw_payload: payment,
      },
      { onConflict: 'provider_payment_id' },
    );

    return new Response('ok', { status: 200 });
  } catch (e) {
    // B2: loga server-side, resposta genérica (sem vazar detalhe).
    console.error('webhook error:', (e as Error).message);
    return new Response('erro interno', { status: 500 });
  }
});
