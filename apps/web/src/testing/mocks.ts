import type { Product } from '@legacystore/shared';
import { SupabaseService } from '../app/core/supabase/supabase.service';

/** Cria um Product completo para testes, com overrides. */
export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    sku: 'SKU-1',
    name: 'Box de Teste',
    slug: 'box-de-teste',
    description: null,
    category_id: null,
    product_type: 'box',
    price: 100,
    compare_at_price: null,
    stock_quantity: 10,
    low_stock_threshold: 5,
    weight_grams: 300,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    is_featured: false,
    is_active: true,
    allow_preorder: false,
    seo_title: null,
    seo_description: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Builder de query encadeável e "thenable" que resolve para { data, error }. */
function queryResult<T>(data: T, error: { message: string } | null = null) {
  const promise = Promise.resolve({ data, error });
  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    in: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve({ data, error }),
    single: () => Promise.resolve({ data, error }),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return builder;
}

export interface SupabaseMockConfig {
  /** Linhas retornadas por qualquer `from(...).select(...)`. */
  rows?: unknown[];
  /** Erro resolvido pela cadeia de `from(...)` (ex.: insert que falha). */
  error?: { message: string } | null;
  /** Resposta de `rpc(name, params)` → { data, error }. */
  rpc?: { data?: unknown; error?: { message: string } | null };
}

/** Mock mínimo do SupabaseService para injetar nos services. */
export function mockSupabase(config: SupabaseMockConfig = {}): SupabaseService {
  const client = {
    from: () => queryResult(config.rows ?? [], config.error ?? null),
    rpc: () => Promise.resolve({ data: config.rpc?.data ?? null, error: config.rpc?.error ?? null }),
  };
  return { client } as unknown as SupabaseService;
}
