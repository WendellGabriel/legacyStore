// Funções puras da store-api (sem dependências de Deno/jsr), extraídas para
// permitir testes unitários em Node (Vitest). Importadas por index.ts.

export interface QuoteItem {
  product_id: string;
  quantity: number;
}

/** Normaliza texto: sem acento, minúsculo, sem espaços nas pontas. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Estimativa de frete por região (base, R$/kg extra, prazo em dias)
export const REGION_TABLE: Record<
  string,
  { pac: [number, number, number]; sedex: [number, number, number] }
> = {
  NE: { pac: [22, 4, 5], sedex: [38, 6, 2] },
  SE: { pac: [28, 5, 7], sedex: [46, 8, 3] },
  SCO: { pac: [32, 6, 9], sedex: [54, 9, 4] },
  N: { pac: [42, 8, 12], sedex: [72, 12, 6] },
};

export const UF_REGION: Record<string, keyof typeof REGION_TABLE> = {
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'SCO', RS: 'SCO', SC: 'SCO', DF: 'SCO', GO: 'SCO', MT: 'SCO', MS: 'SCO',
  AC: 'N', AM: 'N', AP: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
};

/** Preço estimado: base + (kg-1 arredondado pra cima) × valor por kg extra. */
export function estimate([base, perKg]: [number, number, number], kg: number): number {
  const extra = Math.max(0, Math.ceil(kg) - 1);
  return Math.round((base + perKg * extra) * 100) / 100;
}

// ---- Validação de entrada (B3) ------------------------------------
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_ITEMS = 100;
export const MAX_QTY = 1000;

/** Valida e normaliza o corpo de /shipping/quote. Retorna null se inválido. */
export function parseQuoteBody(body: unknown): { cep: string; items: QuoteItem[] } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const cep = typeof b.cep === 'string' ? b.cep.replace(/\D/g, '') : '';
  if (cep.length !== 8) return null;
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > MAX_ITEMS) return null;
  const items: QuoteItem[] = [];
  for (const raw of b.items) {
    const it = raw as Record<string, unknown>;
    const pid = it?.product_id;
    const qty = it?.quantity;
    if (typeof pid !== 'string' || !UUID_RE.test(pid)) return null;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) return null;
    items.push({ product_id: pid, quantity: qty });
  }
  return { cep, items };
}

/** Valida o formato do número do pedido (LS-YYYYMMDD-00000). */
export function parseOrderNumber(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const on = (body as Record<string, unknown>).order_number;
  if (typeof on !== 'string' || !/^LS-\d{8}-\d{5}$/.test(on)) return null;
  return on;
}
