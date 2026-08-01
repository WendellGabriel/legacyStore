import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Address, ShippingQuote } from '@legacystore/shared';
import { Checkout } from './checkout';
import { CartService } from '../../core/cart/cart.service';
import { AuthService } from '../../core/auth/auth.service';
import { AddressService } from '../account/address.service';
import { OrderService } from '../account/order.service';
import { PaymentService } from './payment.service';

const addr: Address = {
  id: 'a1',
  user_id: 'u1',
  label: 'Casa',
  recipient: 'Ana',
  cep: '50000000',
  street: 'Rua X',
  number: '10',
  complement: null,
  neighborhood: 'Boa Vista',
  city: 'Recife',
  state: 'PE',
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as Address;

const quote: ShippingQuote = { method: 'correios', service: 'PAC', price: 12, delivery_days: 5 };

const clear = vi.fn();
const create = vi.fn();
const startCheckout = vi.fn();

interface FetchResult {
  ok?: boolean;
  body?: unknown;
}

interface BuildOpts {
  empty?: boolean;
  addresses?: Address[];
  fetch?: FetchResult;
}

interface CheckoutShape {
  addresses: (v?: Address[]) => Address[];
  selectedShipping: () => ShippingQuote | null;
  quotes: () => ShippingQuote[];
  shippingError: () => string | null;
  placeError: () => string | null;
  grandTotal: () => number;
  selectAddress: (id: string) => Promise<void>;
  placeOrder: () => Promise<void>;
}

function build(opts: BuildOpts = {}) {
  clear.mockReset();
  create.mockReset();
  startCheckout.mockReset();

  const f = opts.fetch ?? { ok: true, body: { quotes: [quote] } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: f.ok ?? true, json: async () => f.body })) as unknown as typeof fetch,
  );

  const cart = {
    total: () => 100,
    subtotal: () => 100,
    lines: () => [],
    couponDiscount: () => 0,
    toOrderItems: () => [{ product_id: 'p1', quantity: 1 }],
    couponCode: () => null,
    isEmpty: () => opts.empty ?? false,
    whenReady: Promise.resolve(),
    clear,
  };

  TestBed.configureTestingModule({
    imports: [Checkout],
    providers: [
      provideRouter([]),
      { provide: CartService, useValue: cart },
      { provide: AuthService, useValue: { user: () => ({ email: 'a@b.com' }), profile: () => ({ phone: '81' }) } },
      {
        provide: AddressService,
        useValue: {
          list: async () => opts.addresses ?? [addr],
          lookupCep: async () => null,
          create: vi.fn(),
        },
      },
      { provide: OrderService, useValue: { create } },
      { provide: PaymentService, useValue: { startCheckout } },
    ],
  });

  const router = TestBed.inject(Router);
  const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const navUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Checkout);
  return {
    cmp: fixture.componentInstance as unknown as CheckoutShape,
    navSpy,
    navUrlSpy,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Checkout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('redireciona para /carrinho quando o carrinho está vazio', async () => {
    const { navUrlSpy } = build({ empty: true });
    await flush();
    expect(navUrlSpy).toHaveBeenCalledWith('/carrinho');
  });

  it('carrega endereços, seleciona o padrão e calcula o frete', async () => {
    const { cmp } = build();
    await flush();
    expect(cmp.quotes().length).toBe(1);
    expect(cmp.selectedShipping()?.service).toBe('PAC');
    expect(cmp.shippingError()).toBeNull();
  });

  it('grandTotal = total do carrinho + frete selecionado', async () => {
    const { cmp } = build();
    await flush();
    expect(cmp.grandTotal()).toBe(112); // 100 + 12
  });

  it('mostra erro quando o cálculo de frete falha', async () => {
    const { cmp } = build({ fetch: { ok: false, body: { error: 'CEP fora de área' } } });
    await flush();
    expect(cmp.shippingError()).toBe('CEP fora de área');
    expect(cmp.selectedShipping()).toBeNull();
  });

  it('placeOrder em modo dev cria o pedido, limpa o carrinho e vai para a confirmação', async () => {
    const { cmp, navSpy } = build();
    await flush();
    create.mockResolvedValue({ order: { order_number: 'LS-20260801-00009' }, error: null });
    startCheckout.mockResolvedValue({}); // sem init_point → modo dev
    await cmp.placeOrder();
    await flush();
    expect(create).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/pedido', 'LS-20260801-00009']);
  });

  it('placeOrder mostra erro quando a criação do pedido falha', async () => {
    const { cmp } = build();
    await flush();
    create.mockResolvedValue({ order: null, error: 'Estoque insuficiente' });
    await cmp.placeOrder();
    expect(cmp.placeError()).toBe('Estoque insuficiente');
    expect(clear).not.toHaveBeenCalled();
  });
});
