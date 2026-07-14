import { Hono } from 'hono';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase-admin';
import { createPreference, isMercadoPagoConfigured } from '../services/mercadopago';

export const paymentRoutes = new Hono();

const checkoutSchema = z.object({ order_number: z.string() });

/** GET /api/payments/mode — informa se está em modo dev (sem MP). */
paymentRoutes.get('/mode', (c) => c.json({ dev: !isMercadoPagoConfigured() }));

/**
 * POST /api/payments/checkout
 * Cria a preferência do Mercado Pago para um pedido e devolve o init_point.
 */
paymentRoutes.post('/checkout', async (c) => {
  const parsed = checkoutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Dados inválidos' }, 400);

  const sb = supabaseAdmin();
  const { data: order } = await sb
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('order_number', parsed.data.order_number)
    .maybeSingle();

  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404);
  if (order.payment_status === 'approved') {
    return c.json({ error: 'Pedido já foi pago' }, 409);
  }

  // Sem credenciais MP: modo dev (frontend simula pagamento).
  if (!isMercadoPagoConfigured()) {
    return c.json({ dev: true, message: 'Mercado Pago não configurado (modo dev).' });
  }

  const appBase = process.env.APP_BASE_URL ?? 'http://localhost:4200';
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NG_APP_SUPABASE_URL;

  try {
    const pref = await createPreference({
      orderNumber: order.order_number,
      items: (order.items ?? []).map((i: { name_snapshot: string; quantity: number; unit_price: number }) => ({
        title: i.name_snapshot,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
      })),
      shippingPrice: Number(order.shipping_total),
      discount: Number(order.discount_total),
      payerEmail: order.customer_email ?? undefined,
      backBaseUrl: appBase,
      notificationUrl: `${supabaseUrl}/functions/v1/payments-webhook`,
    });

    // O registro definitivo do pagamento é criado pelo webhook (Edge Function),
    // que é a fonte de verdade do status.
    return c.json({ init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

/**
 * POST /api/payments/dev-confirm — SÓ em modo dev (sem MP configurado).
 * Marca o pedido como pago, para testar o fluxo sem credenciais.
 */
paymentRoutes.post('/dev-confirm', async (c) => {
  if (isMercadoPagoConfigured()) {
    return c.json({ error: 'Indisponível: Mercado Pago está configurado.' }, 403);
  }
  const parsed = checkoutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Dados inválidos' }, 400);

  const sb = supabaseAdmin();
  const { data: order } = await sb
    .from('orders')
    .select('id')
    .eq('order_number', parsed.data.order_number)
    .maybeSingle();
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404);

  await sb.from('orders').update({ payment_status: 'approved', status: 'paid' }).eq('id', order.id);
  await sb.from('payments').insert({
    order_id: order.id,
    provider: 'dev',
    method: 'manual',
    amount: 0,
    status: 'approved',
  });

  return c.json({ ok: true, status: 'paid' });
});
