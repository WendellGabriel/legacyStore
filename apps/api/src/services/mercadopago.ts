const MP_API = 'https://api.mercadopago.com';

interface PreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
}

export interface CreatePreferenceInput {
  orderNumber: string;
  items: PreferenceItem[];
  shippingPrice: number;
  discount: number;
  payerEmail?: string;
  backBaseUrl: string; // ex.: https://minhaloja.com
  notificationUrl: string; // Edge Function do webhook
}

export interface PreferenceResult {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

function token(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error('MP_ACCESS_TOKEN não configurado.');
  return t;
}

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN;
}

/**
 * Cria uma preferência de pagamento (Checkout Pro).
 * Aceita PIX, cartão e boleto na tela hospedada do Mercado Pago.
 */
export async function createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
  const items = input.items.map((i) => ({
    title: i.title,
    quantity: i.quantity,
    unit_price: Math.round(i.unit_price * 100) / 100,
    currency_id: 'BRL',
  }));

  // frete e desconto entram como itens ajustando o total
  if (input.shippingPrice > 0) {
    items.push({ title: 'Frete', quantity: 1, unit_price: input.shippingPrice, currency_id: 'BRL' });
  }
  if (input.discount > 0) {
    items.push({ title: 'Desconto', quantity: 1, unit_price: -input.discount, currency_id: 'BRL' });
  }

  const body = {
    items,
    external_reference: input.orderNumber,
    payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    back_urls: {
      success: `${input.backBaseUrl}/pedido/${input.orderNumber}?status=aprovado`,
      pending: `${input.backBaseUrl}/pedido/${input.orderNumber}?status=pendente`,
      failure: `${input.backBaseUrl}/pedido/${input.orderNumber}?status=recusado`,
    },
    auto_return: 'approved',
    notification_url: input.notificationUrl,
    statement_descriptor: 'LEGACYSTORE',
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Mercado Pago erro ${res.status}: ${detail}`);
  }
  return (await res.json()) as PreferenceResult;
}

/** Consulta um pagamento por id (usado pelo webhook para confirmar status). */
export async function getPayment(paymentId: string): Promise<{
  status: string;
  external_reference: string;
  transaction_amount: number;
  payment_method_id: string;
} | null> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    status: string;
    external_reference: string;
    transaction_amount: number;
    payment_method_id: string;
  };
}
