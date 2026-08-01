// Lógica pura do order-emails (sem Deno/jsr) — testável em Node (Vitest).

import type { OrderEmailEvent } from './templates.ts';

export interface OrderRow {
  status?: string | null;
  payment_status?: string | null;
  tracking_code?: string | null;
}

/**
 * Deriva o evento de e-mail a partir do payload do Database Webhook.
 * - INSERT            → 'created'
 * - UPDATE p/ paid    → 'paid'    (status saiu de != paid para == paid)
 * - UPDATE p/ shipped → 'shipped' (entrou em shipped ou ganhou/trocou rastreio)
 * Retorna null quando a mudança não deve gerar e-mail.
 */
export function deriveEvent(
  type: string,
  record: OrderRow | null,
  oldRecord: OrderRow | null,
): OrderEmailEvent | null {
  if (!record) return null;
  if (type === 'INSERT') return 'created';
  if (type !== 'UPDATE') return null;
  const old = oldRecord ?? {};

  if (record.status === 'paid' && old.status !== 'paid') return 'paid';

  if (record.status === 'shipped') {
    const enteredShipped = old.status !== 'shipped';
    const trackingChanged =
      !!record.tracking_code && record.tracking_code !== old.tracking_code;
    if (enteredShipped || trackingChanged) return 'shipped';
  }
  return null;
}
