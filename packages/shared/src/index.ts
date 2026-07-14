/**
 * Tipos e utilitários compartilhados entre o frontend (Angular) e o backend.
 * Ex.: interfaces de entidades, DTOs, enums, constantes de rota.
 *
 * Uso: import { ApiResponse } from '@legacystore/shared';
 */

/** Envelope padrão para respostas da API. */
export interface ApiResponse<T> {
  data: T;
  error: string | null;
}

// As entidades do domínio (ex.: Product, User) entram aqui depois que
// definirmos o tipo de app.
