import { describe, expect, it } from 'vitest';
import { brl, esc, renderOrderEmail, type OrderEmailData } from './templates.ts';
import { deriveEvent } from './logic.ts';

const sample: OrderEmailData = {
  order_number: 'LS-20260801-00042',
  customer_name: 'Ana Lima',
  subtotal: 250,
  discount_total: 15,
  shipping_total: 12,
  grand_total: 247,
  shipping_service: 'PAC',
  shipping_days: 5,
  tracking_code: 'BR123456789BR',
  items: [
    { name: 'Booster Box Pokémon', quantity: 2, unit_price: 100, line_total: 200 },
    { name: 'Sleeve Premium', quantity: 1, unit_price: 50, line_total: 50 },
  ],
};

const opts = { storeName: 'legacyStore', baseUrl: 'https://legacy-store-web.vercel.app/' };

describe('brl', () => {
  it('formata em Real com milhar e centavos', () => {
    expect(brl(1234.5)).toBe('R$ 1.234,50');
    expect(brl(0)).toBe('R$ 0,00');
    expect(brl(-15)).toBe('-R$ 15,00');
  });
  it('trata valores inválidos como zero', () => {
    expect(brl(NaN)).toBe('R$ 0,00');
  });
});

describe('esc', () => {
  it('escapa HTML perigoso', () => {
    expect(esc('<script>"x"')).toBe('&lt;script&gt;&quot;x&quot;');
  });
});

describe('renderOrderEmail', () => {
  it('created: assunto e chamada corretos', () => {
    const r = renderOrderEmail('created', sample, opts);
    expect(r.subject).toContain('Recebemos seu pedido LS-20260801-00042');
    expect(r.html).toContain('Pedido recebido!');
    expect(r.html).toContain('Ver meu pedido');
    // não mostra rastreio no created
    expect(r.html).not.toContain('Código de rastreio');
  });

  it('paid: confirma pagamento', () => {
    const r = renderOrderEmail('paid', sample, opts);
    expect(r.subject).toContain('Pagamento confirmado');
    expect(r.html).toContain('Pagamento confirmado!');
  });

  it('shipped: inclui bloco de rastreio', () => {
    const r = renderOrderEmail('shipped', sample, opts);
    expect(r.subject).toContain('foi enviado');
    expect(r.html).toContain('Código de rastreio');
    expect(r.html).toContain('BR123456789BR');
  });

  it('renderiza itens, totais e link do pedido (sem barra dupla)', () => {
    const r = renderOrderEmail('created', sample, opts);
    expect(r.html).toContain('Booster Box Pokémon');
    expect(r.html).toContain(brl(247));
    expect(r.html).toContain('- R$ 15,00'); // desconto
    expect(r.html).toContain('https://legacy-store-web.vercel.app/pedido/LS-20260801-00042');
    expect(r.text).toContain('LS-20260801-00042');
  });

  it('saúda sem nome quando ausente', () => {
    const r = renderOrderEmail('created', { ...sample, customer_name: null }, opts);
    expect(r.html).toContain('Olá!');
  });

  it('mostra "Grátis" quando frete zero', () => {
    const r = renderOrderEmail('created', { ...sample, shipping_total: 0 }, opts);
    expect(r.html).toContain('Grátis');
  });
});

describe('deriveEvent', () => {
  it('INSERT → created', () => {
    expect(deriveEvent('INSERT', { status: 'pending' }, null)).toBe('created');
  });
  it('UPDATE pending→paid → paid', () => {
    expect(deriveEvent('UPDATE', { status: 'paid' }, { status: 'pending' })).toBe('paid');
  });
  it('UPDATE já pago (paid→paid) → null (não reenviar)', () => {
    expect(deriveEvent('UPDATE', { status: 'paid' }, { status: 'paid' })).toBeNull();
  });
  it('UPDATE paid→shipped → shipped', () => {
    expect(
      deriveEvent('UPDATE', { status: 'shipped', tracking_code: 'X' }, { status: 'paid' }),
    ).toBe('shipped');
  });
  it('UPDATE shipped com novo rastreio → shipped', () => {
    expect(
      deriveEvent(
        'UPDATE',
        { status: 'shipped', tracking_code: 'NOVO' },
        { status: 'shipped', tracking_code: 'ANTIGO' },
      ),
    ).toBe('shipped');
  });
  it('UPDATE shipped→shipped mesmo rastreio → null', () => {
    expect(
      deriveEvent(
        'UPDATE',
        { status: 'shipped', tracking_code: 'X' },
        { status: 'shipped', tracking_code: 'X' },
      ),
    ).toBeNull();
  });
  it('UPDATE irrelevante (só nota) → null', () => {
    expect(deriveEvent('UPDATE', { status: 'pending' }, { status: 'pending' })).toBeNull();
  });
  it('DELETE / record nulo → null', () => {
    expect(deriveEvent('DELETE', null, { status: 'paid' })).toBeNull();
  });
});
