import { TestBed } from '@angular/core/testing';
import type { Address, ShippingQuote } from '@legacystore/shared';
import { OrderService, type CreateOrderParams } from './order.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { mockSupabase, type SupabaseMockConfig } from '../../../testing/mocks';

function create(config: SupabaseMockConfig = {}): OrderService {
  TestBed.configureTestingModule({
    providers: [OrderService, { provide: SupabaseService, useValue: mockSupabase(config) }],
  });
  return TestBed.inject(OrderService);
}

const shipping: ShippingQuote = {
  method: 'correios',
  service: 'PAC',
  price: 20,
  delivery_days: 5,
  quote_id: 'q1',
};

const params: CreateOrderParams = {
  items: [{ product_id: 'p1', quantity: 1 }],
  address: {} as Address,
  shipping,
  couponCode: null,
  customerEmail: 'a@b.com',
};

describe('OrderService.create', () => {
  it('retorna o pedido quando a RPC tem sucesso', async () => {
    const svc = create({ rpc: { data: { id: 'o1', order_number: 'LS-20260724-00001' } } });
    const { order, error } = await svc.create(params);
    expect(error).toBeUndefined();
    expect(order?.order_number).toBe('LS-20260724-00001');
  });

  it('mantém a mensagem de estoque insuficiente', async () => {
    const svc = create({ rpc: { error: { message: 'Estoque insuficiente para "Box": restam 2' } } });
    const { error } = await svc.create(params);
    expect(error).toBe('Estoque insuficiente para "Box": restam 2');
  });

  it('traduz produto indisponível', async () => {
    const svc = create({ rpc: { error: { message: 'Produto indisponível' } } });
    expect((await svc.create(params)).error).toBe('Um dos produtos ficou indisponível.');
  });

  it('traduz erro de cotação de frete', async () => {
    const svc = create({ rpc: { error: { message: 'Cotação de frete expirada. Recalcule o frete.' } } });
    expect((await svc.create(params)).error).toBe(
      'O frete precisa ser recalculado. Revise seu endereço e tente novamente.',
    );
  });

  it('mantém a mensagem de cupom', async () => {
    const svc = create({ rpc: { error: { message: 'Cupom: expirado' } } });
    expect((await svc.create(params)).error).toBe('Cupom: expirado');
  });

  it('usa mensagem genérica para erros desconhecidos', async () => {
    const svc = create({ rpc: { error: { message: 'algo estranho no banco' } } });
    expect((await svc.create(params)).error).toBe(
      'Não foi possível finalizar o pedido. Tente novamente.',
    );
  });
});
