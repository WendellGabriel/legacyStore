import { describe, it, expect } from 'vitest';
import {
  norm,
  estimate,
  UF_REGION,
  REGION_TABLE,
  parseQuoteBody,
  parseOrderNumber,
} from './lib.ts';

const UUID = '00000000-0000-0000-0000-000000000001';

describe('norm', () => {
  it('remove acento, baixa a caixa e apara espaços', () => {
    expect(norm('  BOA VIAGEM  ')).toBe('boa viagem');
    expect(norm('São Paulo')).toBe('sao paulo');
    expect(norm('Jaboatão dos Guararapes')).toBe('jaboatao dos guararapes');
  });
});

describe('estimate (frete por peso)', () => {
  it('até 1kg cobra só a base', () => {
    expect(estimate([22, 4, 5], 0.3)).toBe(22);
    expect(estimate([22, 4, 5], 1)).toBe(22);
  });

  it('cada kg extra (arredondado pra cima) soma o valor por kg', () => {
    expect(estimate([22, 4, 5], 2)).toBe(26); // 22 + 4*1
    expect(estimate([28, 5, 7], 3.2)).toBe(43); // ceil(3.2)=4 → 28 + 5*3
  });
});

describe('UF_REGION / REGION_TABLE', () => {
  it('mapeia UFs para a região correta', () => {
    expect(UF_REGION['PE']).toBe('NE');
    expect(UF_REGION['SP']).toBe('SE');
    expect(UF_REGION['PR']).toBe('SCO');
    expect(UF_REGION['AM']).toBe('N');
  });

  it('toda região tem tabela PAC e SEDEX', () => {
    for (const region of Object.values(UF_REGION)) {
      expect(REGION_TABLE[region].pac).toHaveLength(3);
      expect(REGION_TABLE[region].sedex).toHaveLength(3);
    }
  });
});

describe('parseQuoteBody (B3)', () => {
  it('aceita corpo válido e normaliza o CEP', () => {
    const r = parseQuoteBody({ cep: '50000-000', items: [{ product_id: UUID, quantity: 2 }] });
    expect(r).toEqual({ cep: '50000000', items: [{ product_id: UUID, quantity: 2 }] });
  });

  it('rejeita CEP com tamanho errado', () => {
    expect(parseQuoteBody({ cep: '123', items: [{ product_id: UUID, quantity: 1 }] })).toBeNull();
  });

  it('rejeita product_id que não é uuid', () => {
    expect(parseQuoteBody({ cep: '50000000', items: [{ product_id: 'x', quantity: 1 }] })).toBeNull();
  });

  it('rejeita quantidade não-inteira, zero, negativa ou acima do teto', () => {
    for (const q of [0, -1, 1.5, 100000]) {
      expect(parseQuoteBody({ cep: '50000000', items: [{ product_id: UUID, quantity: q }] })).toBeNull();
    }
  });

  it('rejeita lista vazia ou corpo não-objeto', () => {
    expect(parseQuoteBody({ cep: '50000000', items: [] })).toBeNull();
    expect(parseQuoteBody(null)).toBeNull();
    expect(parseQuoteBody('nope')).toBeNull();
  });
});

describe('parseOrderNumber (B3)', () => {
  it('aceita o formato LS-YYYYMMDD-00000', () => {
    expect(parseOrderNumber({ order_number: 'LS-20260724-00001' })).toBe('LS-20260724-00001');
  });

  it('rejeita formatos inválidos', () => {
    expect(parseOrderNumber({ order_number: 'formato-errado' })).toBeNull();
    expect(parseOrderNumber({ order_number: 'LS-2026-1' })).toBeNull();
    expect(parseOrderNumber({})).toBeNull();
    expect(parseOrderNumber(null)).toBeNull();
  });
});
