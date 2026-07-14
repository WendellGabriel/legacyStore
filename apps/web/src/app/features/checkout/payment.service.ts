import { Injectable } from '@angular/core';

export interface CheckoutResult {
  init_point?: string;
  sandbox_init_point?: string;
  dev?: boolean;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  /** Cria a preferência de pagamento (ou sinaliza modo dev). */
  async startCheckout(orderNumber: string): Promise<CheckoutResult> {
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber }),
      });
      return (await res.json()) as CheckoutResult;
    } catch {
      return { error: 'Falha ao iniciar o pagamento.' };
    }
  }

  /** Modo dev (sem Mercado Pago): confirma o pagamento manualmente. */
  async devConfirm(orderNumber: string): Promise<boolean> {
    try {
      const res = await fetch('/api/payments/dev-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
