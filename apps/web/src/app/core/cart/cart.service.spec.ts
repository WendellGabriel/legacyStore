import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { SupabaseService } from '../supabase/supabase.service';
import { makeProduct, mockSupabase, type SupabaseMockConfig } from '../../../testing/mocks';

function create(config: SupabaseMockConfig = {}): CartService {
  TestBed.configureTestingModule({
    providers: [CartService, { provide: SupabaseService, useValue: mockSupabase(config) }],
  });
  return TestBed.inject(CartService);
}

describe('CartService', () => {
  beforeEach(() => localStorage.clear());

  it('começa vazio', () => {
    const cart = create();
    expect(cart.isEmpty()).toBe(true);
    expect(cart.count()).toBe(0);
    expect(cart.subtotal()).toBe(0);
  });

  it('add adiciona e soma count/subtotal', () => {
    const cart = create();
    cart.add(makeProduct({ id: 'p1', price: 100 }), 2);
    expect(cart.count()).toBe(2);
    expect(cart.subtotal()).toBe(200);
    expect(cart.isEmpty()).toBe(false);
  });

  it('add do mesmo produto acumula a quantidade', () => {
    const cart = create();
    const p = makeProduct({ id: 'p1', price: 50, stock_quantity: 10 });
    cart.add(p, 1);
    cart.add(p, 2);
    expect(cart.count()).toBe(3);
    expect(cart.subtotal()).toBe(150);
  });

  it('add respeita o estoque máximo', () => {
    const cart = create();
    cart.add(makeProduct({ id: 'p1', stock_quantity: 3 }), 10);
    expect(cart.count()).toBe(3);
  });

  it('setQuantity ajusta e limita ao estoque', () => {
    const cart = create();
    cart.add(makeProduct({ id: 'p1', stock_quantity: 5, price: 10 }), 1);
    cart.setQuantity('p1', 4);
    expect(cart.count()).toBe(4);
    cart.setQuantity('p1', 99);
    expect(cart.count()).toBe(5); // limitado ao estoque
  });

  it('setQuantity <= 0 remove o item', () => {
    const cart = create();
    cart.add(makeProduct({ id: 'p1' }), 2);
    cart.setQuantity('p1', 0);
    expect(cart.isEmpty()).toBe(true);
  });

  it('remove e clear esvaziam o carrinho', () => {
    const cart = create();
    cart.add(makeProduct({ id: 'p1' }), 1);
    cart.add(makeProduct({ id: 'p2' }), 1);
    cart.remove('p1');
    expect(cart.count()).toBe(1);
    cart.clear();
    expect(cart.isEmpty()).toBe(true);
  });

  it('toOrderItems reflete o conteúdo', () => {
    const cart = create();
    cart.add(makeProduct({ id: 'p1' }), 2);
    expect(cart.toOrderItems()).toEqual([{ product_id: 'p1', quantity: 2 }]);
  });

  it('applyCoupon aplica o desconto quando a RPC valida', async () => {
    const cart = create({ rpc: { data: { valid: true, discount: 15 } } });
    cart.add(makeProduct({ id: 'p1', price: 100 }), 1);
    const err = await cart.applyCoupon('PRIMEIRACOMPRA');
    expect(err).toBeNull();
    expect(cart.couponDiscount()).toBe(15);
    expect(cart.total()).toBe(85);
    expect(cart.couponCode()).toBe('PRIMEIRACOMPRA');
  });

  it('applyCoupon retorna o motivo quando a RPC invalida', async () => {
    const cart = create({ rpc: { data: { valid: false, reason: 'Cupom expirado' } } });
    cart.add(makeProduct({ id: 'p1', price: 100 }), 1);
    const err = await cart.applyCoupon('VELHO');
    expect(err).toBe('Cupom expirado');
    expect(cart.couponDiscount()).toBe(0);
  });

  it('applyCoupon rejeita entrada vazia', async () => {
    const cart = create();
    expect(await cart.applyCoupon('   ')).toBe('Informe um cupom');
  });

  it('total nunca fica negativo', () => {
    const cart = create();
    cart.add(makeProduct({ id: 'p1', price: 10 }), 1);
    cart.couponDiscount.set(999);
    expect(cart.total()).toBe(0);
  });
});
