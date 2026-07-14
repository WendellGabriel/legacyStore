import type { ShippingQuote } from '@legacystore/shared';
import { supabaseAdmin } from '../lib/supabase-admin';
import { lookupCep } from './cep';

interface OrderItem {
  product_id: string;
  quantity: number;
}

/** Normaliza texto para casar bairro/cidade (sem acento, minúsculo). */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Peso total do pedido em gramas (mínimo 300g). */
async function totalWeightGrams(items: OrderItem[]): Promise<number> {
  const ids = items.map((i) => i.product_id);
  const { data } = await supabaseAdmin()
    .from('products')
    .select('id, weight_grams')
    .in('id', ids);

  const weights = new Map((data ?? []).map((p) => [p.id, p.weight_grams ?? 300]));
  const total = items.reduce((sum, i) => sum + (weights.get(i.product_id) ?? 300) * i.quantity, 0);
  return Math.max(total, 300);
}

// Estimativa por região (UF) — PLACEHOLDER até haver contrato Correios.
// base = preço até 1kg; perKg = adicional por kg extra; days = prazo.
const REGION_TABLE: Record<string, { pac: { base: number; perKg: number; days: number }; sedex: { base: number; perKg: number; days: number } }> = {
  // Nordeste (origem PE) — mais barato/rápido
  NE: { pac: { base: 22, perKg: 4, days: 5 }, sedex: { base: 38, perKg: 6, days: 2 } },
  // Sudeste
  SE: { pac: { base: 28, perKg: 5, days: 7 }, sedex: { base: 46, perKg: 8, days: 3 } },
  // Sul / Centro-Oeste
  SCO: { pac: { base: 32, perKg: 6, days: 9 }, sedex: { base: 54, perKg: 9, days: 4 } },
  // Norte — mais caro/lento
  N: { pac: { base: 42, perKg: 8, days: 12 }, sedex: { base: 72, perKg: 12, days: 6 } },
};

const UF_REGION: Record<string, keyof typeof REGION_TABLE> = {
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'SCO', RS: 'SCO', SC: 'SCO', DF: 'SCO', GO: 'SCO', MT: 'SCO', MS: 'SCO',
  AC: 'N', AM: 'N', AP: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
};

function estimate(part: { base: number; perKg: number; days: number }, kg: number): number {
  const extraKg = Math.max(0, Math.ceil(kg) - 1);
  return Math.round((part.base + part.perKg * extraKg) * 100) / 100;
}

/**
 * Calcula opções de frete para um CEP + itens.
 * 1) Se o bairro estiver cadastrado em shipping_zones (RM Recife) → frete personalizado.
 * 2) Senão → estimativa Correios (PAC/SEDEX) por região. [placeholder até contrato]
 */
export async function calculateShipping(
  cep: string,
  items: OrderItem[],
): Promise<{ quotes: ShippingQuote[]; destination: string | null }> {
  const info = await lookupCep(cep);
  if (!info) return { quotes: [], destination: null };

  const destination = `${info.city} - ${info.state}`;

  // 1) Zona personalizada (Recife metropolitana)
  if (info.neighborhood) {
    const { data: zones } = await supabaseAdmin()
      .from('shipping_zones')
      .select('*')
      .eq('is_active', true);

    const match = (zones ?? []).find(
      (z) => norm(z.city) === norm(info.city) && norm(z.neighborhood) === norm(info.neighborhood!),
    );
    if (match) {
      return {
        destination,
        quotes: [
          {
            method: 'recife_zone',
            service: 'Entrega local',
            price: Number(match.price),
            delivery_days: match.delivery_days,
          },
        ],
      };
    }
  }

  // 2) Estimativa por região
  const region = UF_REGION[info.state];
  if (!region) return { quotes: [], destination };

  const kg = (await totalWeightGrams(items)) / 1000;
  const table = REGION_TABLE[region];

  return {
    destination,
    quotes: [
      { method: 'correios', service: 'PAC', price: estimate(table.pac, kg), delivery_days: table.pac.days },
      { method: 'correios', service: 'SEDEX', price: estimate(table.sedex, kg), delivery_days: table.sedex.days },
    ],
  };
}
