// Edge Function (Deno): webhook do Mercado Pago.
// Recebe a notificação, consulta o pagamento na API do MP e atualiza o pedido.
// Roda colada ao banco (service_role) para máxima confiabilidade.
//
// Deploy:  supabase functions deploy payments-webhook --no-verify-jwt
// Segredo: supabase secrets set MP_ACCESS_TOKEN=... (SUPABASE_URL e
//          SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MP_API = 'https://api.mercadopago.com';

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
      .select('id')
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
    const mapped = map[payment.status] ?? { payment_status: 'pending' };

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
    return new Response(`erro: ${(e as Error).message}`, { status: 500 });
  }
});
