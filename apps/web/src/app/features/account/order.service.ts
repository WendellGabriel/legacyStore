import { inject, Injectable } from '@angular/core';
import type { Address, Order, ShippingQuote } from '@legacystore/shared';
import { SupabaseService } from '../../core/supabase/supabase.service';

export interface CreateOrderParams {
  items: { product_id: string; quantity: number }[];
  address: Address;
  shipping: ShippingQuote;
  couponCode: string | null;
  customerEmail: string;
  customerPhone?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly supabase = inject(SupabaseService);

  /** Cria o pedido de forma atômica (valida estoque, baixa estoque). */
  async create(params: CreateOrderParams): Promise<{ order?: Order; error?: string }> {
    const { data, error } = await this.supabase.client.rpc('create_order', {
      p_items: params.items,
      p_shipping_address: params.address,
      p_shipping_method: params.shipping.method,
      p_shipping_service: params.shipping.service,
      p_shipping_total: params.shipping.price,
      p_shipping_days: params.shipping.delivery_days,
      p_coupon_code: params.couponCode,
      p_customer_email: params.customerEmail,
      p_customer_phone: params.customerPhone ?? null,
      // frete autoritativo: o servidor usa a cotação persistida e ignora o
      // p_shipping_total do cliente quando o quote_id está presente (ver A1).
      p_quote_id: params.shipping.quote_id ?? null,
    });

    if (error) return { error: this.translate(error.message) };
    return { order: data as Order };
  }

  async listMine(): Promise<Order[]> {
    const { data } = await this.supabase.client
      .from('orders')
      .select('*, items:order_items(*)')
      .order('created_at', { ascending: false });
    return (data as Order[]) ?? [];
  }

  async getByNumber(orderNumber: string): Promise<Order | null> {
    const { data } = await this.supabase.client
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('order_number', orderNumber)
      .maybeSingle();
    return (data as Order) ?? null;
  }

  /** Histórico de mudanças de status de um pedido. */
  async getStatusHistory(
    orderId: string,
  ): Promise<{ to_status: string; created_at: string }[]> {
    const { data } = await this.supabase.client
      .from('order_status_history')
      .select('to_status, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    return (data as { to_status: string; created_at: string }[]) ?? [];
  }

  private translate(msg: string): string {
    if (/estoque insuficiente/i.test(msg)) return msg;
    if (/indispon/i.test(msg)) return 'Um dos produtos ficou indisponível.';
    if (/cupom/i.test(msg)) return msg;
    if (/cotação de frete|frete inválido|itens divergem/i.test(msg))
      return 'O frete precisa ser recalculado. Revise seu endereço e tente novamente.';
    return 'Não foi possível finalizar o pedido. Tente novamente.';
  }
}
