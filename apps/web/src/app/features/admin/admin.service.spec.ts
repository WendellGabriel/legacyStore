import { TestBed } from '@angular/core/testing';
import type { Product } from '@legacystore/shared';
import { AdminService } from './admin.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { makeProduct } from '../../../testing/mocks';

/**
 * Mock que devolve o produto de origem em `maybeSingle` (getProduct), um novo id
 * em `single` (createProduct) e captura os payloads de `insert`.
 */
function adminMock(src: Product) {
  const inserts: unknown[] = [];
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (arg: unknown) => {
      inserts.push(arg);
      return builder;
    },
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve({ data: src, error: null }),
    single: () => Promise.resolve({ data: { id: 'new-id' }, error: null }),
    then: (r: (v: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(r),
  };
  const service = { client: { from: () => builder } } as unknown as SupabaseService;
  return { service, inserts };
}

describe('AdminService.duplicateProduct', () => {
  function setup(src: Product) {
    const { service, inserts } = adminMock(src);
    TestBed.configureTestingModule({
      providers: [AdminService, { provide: SupabaseService, useValue: service }],
    });
    return { svc: TestBed.inject(AdminService), inserts };
  }

  it('clona como rascunho inativo, com estoque 0 e SKU/slug novos', async () => {
    const src = makeProduct({
      id: 'src1',
      sku: 'BOX-1',
      slug: 'box-1',
      name: 'Box Pokémon',
      stock_quantity: 20,
      is_active: true,
      is_featured: true,
    });
    const { svc, inserts } = setup(src);

    const { id, error } = await svc.duplicateProduct('src1');
    expect(error).toBeUndefined();
    expect(id).toBe('new-id');

    const productInsert = inserts[0] as Record<string, unknown>;
    expect(productInsert['is_active']).toBe(false);
    expect(productInsert['is_featured']).toBe(false);
    expect(productInsert['stock_quantity']).toBe(0);
    expect(productInsert['name']).toBe('Box Pokémon (cópia)');
    expect(String(productInsert['sku'])).toMatch(/^BOX-1-COPIA-/);
    expect(String(productInsert['slug'])).toMatch(/^box-1-copia-/);
  });

  it('copia as imagens do produto de origem para o clone', async () => {
    const src = makeProduct({
      id: 'src1',
      images: [
        { id: 'i1', product_id: 'src1', url: 'a.jpg', alt: null, position: 0 },
        { id: 'i2', product_id: 'src1', url: 'b.jpg', alt: 'B', position: 1 },
      ],
    });
    const { svc, inserts } = setup(src);
    await svc.duplicateProduct('src1');

    // inserts[0] = produto; inserts[1] = array de imagens
    const imageInsert = inserts[1] as { product_id: string; url: string; position: number }[];
    expect(imageInsert).toHaveLength(2);
    expect(imageInsert[0]).toMatchObject({ product_id: 'new-id', url: 'a.jpg', position: 0 });
    expect(imageInsert[1]).toMatchObject({ product_id: 'new-id', url: 'b.jpg', position: 1 });
  });
});
