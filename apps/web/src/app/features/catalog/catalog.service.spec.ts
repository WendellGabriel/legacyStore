import { TestBed } from '@angular/core/testing';
import { CatalogService } from './catalog.service';
import { SupabaseService } from '../../core/supabase/supabase.service';

type Call = [string, unknown[]];

/**
 * Client que grava toda chamada da query. A cadeia encadeia até `.range()`,
 * que resolve com { data, count }. Permite verificar o mapeamento
 * filtro → operador do Supabase sem um banco real.
 */
function recordingSupabase(): { service: SupabaseService; calls: Call[] } {
  const calls: Call[] = [];
  const builder: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'range') {
          return (from: number, to: number) => {
            calls.push(['range', [from, to]]);
            return Promise.resolve({ data: [], count: 0 });
          };
        }
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return builder;
        };
      },
    },
  );
  const client = {
    from: (table: string) => {
      calls.push(['from', [table]]);
      return builder;
    },
  };
  return { service: { client } as unknown as SupabaseService, calls };
}

function has(calls: Call[], name: string, args: unknown[]): boolean {
  return calls.some(([n, a]) => n === name && JSON.stringify(a) === JSON.stringify(args));
}

describe('CatalogService.listProducts', () => {
  function setup() {
    const { service, calls } = recordingSupabase();
    TestBed.configureTestingModule({
      providers: [CatalogService, { provide: SupabaseService, useValue: service }],
    });
    return { svc: TestBed.inject(CatalogService), calls };
  }

  it('sempre filtra por is_active e pagina com range', async () => {
    const { svc, calls } = setup();
    await svc.listProducts({ page: 2, pageSize: 12 });
    expect(has(calls, 'from', ['products'])).toBe(true);
    expect(has(calls, 'eq', ['is_active', true])).toBe(true);
    expect(has(calls, 'range', [12, 23])).toBe(true); // page 2, size 12 → 12..23
  });

  it('mapeia busca, tipo, faixa de preço, estoque e promoção', async () => {
    const { svc, calls } = setup();
    await svc.listProducts({
      search: 'pikachu',
      productType: 'box',
      minPrice: 10,
      maxPrice: 200,
      onlyInStock: true,
      onSale: true,
    });
    expect(has(calls, 'ilike', ['name', '%pikachu%'])).toBe(true);
    expect(has(calls, 'eq', ['product_type', 'box'])).toBe(true);
    expect(has(calls, 'gte', ['price', 10])).toBe(true);
    expect(has(calls, 'lte', ['price', 200])).toBe(true);
    expect(has(calls, 'gt', ['stock_quantity', 0])).toBe(true);
    expect(has(calls, 'not', ['compare_at_price', 'is', null])).toBe(true);
  });

  it('ordena por preço crescente', async () => {
    const { svc, calls } = setup();
    await svc.listProducts({ sort: 'price_asc' });
    expect(has(calls, 'order', ['price', { ascending: true }])).toBe(true);
  });

  it('ordena por mais novos por padrão', async () => {
    const { svc, calls } = setup();
    await svc.listProducts({});
    expect(has(calls, 'order', ['created_at', { ascending: false }])).toBe(true);
  });

  it('não aplica filtros quando ausentes', async () => {
    const { svc, calls } = setup();
    await svc.listProducts({});
    expect(has(calls, 'ilike', ['name', '%undefined%'])).toBe(false);
    expect(calls.some(([n]) => n === 'gte' || n === 'lte' || n === 'gt')).toBe(false);
  });

  it('retorna { products, total } a partir de data/count', async () => {
    const { svc } = setup();
    const res = await svc.listProducts({});
    expect(res).toEqual({ products: [], total: 0 });
  });
});
