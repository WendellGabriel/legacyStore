/**
 * Tipos e utilitários compartilhados entre o frontend (Angular) e o backend (Hono).
 * Uso: import { Product, OrderStatus } from '@legacystore/shared';
 */

export * from './constants';
export * from './types';
export * from './schemas';

/** Envelope padrão para respostas da API. */
export interface ApiResponse<T> {
  data: T;
  error: string | null;
}
