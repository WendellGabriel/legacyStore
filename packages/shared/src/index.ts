/**
 * Tipos e utilitários compartilhados entre o frontend (Angular) e o backend (Hono).
 * Uso: import { Product, OrderStatus } from '@legacystore/shared';
 */

export * from './constants';
export * from './types';
export * from './schemas';

import type { Product } from './types';

/** Envelope padrão para respostas da API. */
export interface ApiResponse<T> {
  data: T;
  error: string | null;
}

/**
 * Um produto está em PRÉ-VENDA quando está esgotado (estoque 0) e a pré-venda
 * está habilitada — seja manualmente no produto (`allow_preorder`) ou pela flag
 * global de pré-venda automática ao zerar (`autoPreorderOnZero`).
 */
export function isPreorder(
  product: Pick<Product, 'stock_quantity' | 'allow_preorder'>,
  autoPreorderOnZero = false,
): boolean {
  return product.stock_quantity <= 0 && (product.allow_preorder || autoPreorderOnZero);
}
