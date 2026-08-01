import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import type { Order } from '@legacystore/shared';
import { Confirmation } from './confirmation';
import { OrderService } from '../account/order.service';
import { PaymentService } from './payment.service';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    order_number: 'LS-20260801-00001',
    user_id: null,
    status: 'pending',
    subtotal: 100,
    discount_total: 0,
    shipping_total: 12,
    grand_total: 112,
    coupon_id: null,
    shipping_address: {},
    shipping_method: 'correios',
    shipping_service: 'PAC',
    shipping_days: 5,
    tracking_code: null,
    payment_status: 'pending',
    payment_method: null,
    customer_email: null,
    customer_phone: null,
    notes: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  } as Order;
}

const getByNumber = vi.fn();
const devConfirm = vi.fn();

interface RouteParams {
  orderNumber?: string | null;
  status?: string | null;
}

function build(params: RouteParams, mode: { dev: boolean } = { dev: false }, order: Order | null = null) {
  getByNumber.mockReset();
  devConfirm.mockReset();
  getByNumber.mockResolvedValue(order);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => mode })) as unknown as typeof fetch,
  );
  const route = {
    snapshot: {
      paramMap: { get: (k: string) => (k === 'orderNumber' ? params.orderNumber ?? null : null) },
      queryParamMap: { get: (k: string) => (k === 'status' ? params.status ?? null : null) },
    },
  };
  TestBed.configureTestingModule({
    imports: [Confirmation],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: route },
      { provide: OrderService, useValue: { getByNumber } },
      { provide: PaymentService, useValue: { devConfirm } },
    ],
  });
  const fixture = TestBed.createComponent(Confirmation);
  return fixture.componentInstance as unknown as {
    order: () => Order | null;
    loading: () => boolean;
    devMode: () => boolean;
    returnStatus: () => string | null;
    isPaid: () => boolean;
    isPending: () => boolean;
    simulatePayment: () => Promise<void>;
  };
}

async function flush() {
  // macrotask: drena todos os microtasks pendentes (Promise.all + fetch→json)
  await new Promise((r) => setTimeout(r, 0));
}

describe('Confirmation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sem orderNumber → não carrega e sai do loading', async () => {
    const cmp = build({ orderNumber: null });
    await flush();
    expect(cmp.order()).toBeNull();
    expect(cmp.loading()).toBe(false);
    expect(getByNumber).not.toHaveBeenCalled();
  });

  it('carrega o pedido e o modo de pagamento', async () => {
    const cmp = build({ orderNumber: 'LS-20260801-00001' }, { dev: true }, makeOrder());
    await flush();
    expect(getByNumber).toHaveBeenCalledWith('LS-20260801-00001');
    expect(cmp.order()?.order_number).toBe('LS-20260801-00001');
    expect(cmp.devMode()).toBe(true);
    expect(cmp.loading()).toBe(false);
  });

  it('isPaid/isPending refletem o payment_status', async () => {
    const cmp = build({ orderNumber: 'LS-1' }, { dev: false }, makeOrder({ payment_status: 'approved' }));
    await flush();
    expect(cmp.isPaid()).toBe(true);
    expect(cmp.isPending()).toBe(false);
  });

  it('captura o status de retorno do Mercado Pago (?status=)', async () => {
    const cmp = build({ orderNumber: 'LS-1', status: 'approved' }, { dev: false }, makeOrder());
    await flush();
    expect(cmp.returnStatus()).toBe('approved');
  });

  it('simulatePayment confirma e recarrega o pedido', async () => {
    const cmp = build({ orderNumber: 'LS-1' }, { dev: true }, makeOrder({ payment_status: 'pending' }));
    devConfirm.mockResolvedValue(true);
    await flush();
    getByNumber.mockResolvedValue(makeOrder({ payment_status: 'approved' }));
    await cmp.simulatePayment();
    await flush();
    expect(devConfirm).toHaveBeenCalledWith('LS-20260801-00001');
    expect(cmp.isPaid()).toBe(true);
  });
});
