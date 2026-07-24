import { describe, it, expect } from 'vitest';
import {
  isPreorder,
  cepSchema,
  addressSchema,
  signUpSchema,
  productFormSchema,
  waitlistInputSchema,
  cartItemInputSchema,
  PRODUCT_TYPES,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
} from './index';

// ---- isPreorder (regra de pré-venda) ------------------------------
describe('isPreorder', () => {
  const base = { stock_quantity: 0, allow_preorder: false };

  it('não é pré-venda quando há estoque', () => {
    expect(isPreorder({ stock_quantity: 5, allow_preorder: true }, true)).toBe(false);
  });

  it('é pré-venda quando esgotado e o produto permite (manual)', () => {
    expect(isPreorder({ stock_quantity: 0, allow_preorder: true }, false)).toBe(true);
  });

  it('é pré-venda quando esgotado e o global automático está ligado', () => {
    expect(isPreorder(base, true)).toBe(true);
  });

  it('não é pré-venda quando esgotado mas nada habilita', () => {
    expect(isPreorder(base, false)).toBe(false);
  });

  it('trata estoque negativo como esgotado', () => {
    expect(isPreorder({ stock_quantity: -3, allow_preorder: true }, false)).toBe(true);
  });

  it('assume autoPreorderOnZero=false por padrão', () => {
    expect(isPreorder({ stock_quantity: 0, allow_preorder: false })).toBe(false);
  });
});

// ---- cepSchema ----------------------------------------------------
describe('cepSchema', () => {
  it('aceita 8 dígitos e remove formatação', () => {
    expect(cepSchema.parse('50000-000')).toBe('50000000');
    expect(cepSchema.parse('50000000')).toBe('50000000');
  });

  it('rejeita CEP com menos de 8 dígitos', () => {
    expect(cepSchema.safeParse('123').success).toBe(false);
  });
});

// ---- addressSchema ------------------------------------------------
describe('addressSchema', () => {
  const valid = {
    recipient: 'Fulano de Tal',
    cep: '50000000',
    street: 'Rua A',
    number: '10',
    neighborhood: 'Centro',
    city: 'Recife',
    state: 'PE',
  };

  it('valida um endereço completo', () => {
    expect(addressSchema.safeParse(valid).success).toBe(true);
  });

  it('rejeita UF fora da lista', () => {
    expect(addressSchema.safeParse({ ...valid, state: 'XX' }).success).toBe(false);
  });

  it('exige o destinatário', () => {
    const { recipient, ...rest } = valid;
    expect(addressSchema.safeParse(rest).success).toBe(false);
  });
});

// ---- signUpSchema -------------------------------------------------
describe('signUpSchema', () => {
  it('exige senha com no mínimo 8 caracteres', () => {
    const r = signUpSchema.safeParse({
      full_name: 'Ana',
      email: 'ana@example.com',
      password: 'curta',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const r = signUpSchema.safeParse({
      full_name: 'Ana',
      email: 'nao-eh-email',
      password: 'senha1234',
    });
    expect(r.success).toBe(false);
  });
});

// ---- productFormSchema --------------------------------------------
describe('productFormSchema', () => {
  const base = {
    sku: 'SKU-1',
    name: 'Box Pokémon',
    slug: 'box-pokemon',
    category_id: null,
    product_type: 'box' as const,
    price: 199.9,
    stock_quantity: 10,
  };

  it('aplica defaults (allow_preorder=false, is_active=true)', () => {
    const r = productFormSchema.parse(base);
    expect(r.allow_preorder).toBe(false);
    expect(r.is_active).toBe(true);
    expect(r.is_featured).toBe(false);
    expect(r.low_stock_threshold).toBe(5);
  });

  it('rejeita preço negativo', () => {
    expect(productFormSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
  });

  it('rejeita product_type inválido', () => {
    expect(productFormSchema.safeParse({ ...base, product_type: 'banana' }).success).toBe(false);
  });

  it('aceita allow_preorder explícito', () => {
    expect(productFormSchema.parse({ ...base, allow_preorder: true }).allow_preorder).toBe(true);
  });
});

// ---- waitlistInputSchema ------------------------------------------
describe('waitlistInputSchema', () => {
  it('exige e-mail válido, whatsapp é opcional', () => {
    expect(waitlistInputSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(waitlistInputSchema.safeParse({ email: 'a@b.com', whatsapp: '81999999999' }).success).toBe(true);
  });

  it('rejeita e-mail inválido', () => {
    expect(waitlistInputSchema.safeParse({ email: 'x' }).success).toBe(false);
  });
});

// ---- cartItemInputSchema ------------------------------------------
describe('cartItemInputSchema', () => {
  const uuid = '00000000-0000-0000-0000-000000000001';

  it('aceita product_id uuid + quantidade inteira positiva', () => {
    expect(cartItemInputSchema.safeParse({ product_id: uuid, quantity: 2 }).success).toBe(true);
  });

  it('rejeita quantidade zero ou negativa', () => {
    expect(cartItemInputSchema.safeParse({ product_id: uuid, quantity: 0 }).success).toBe(false);
    expect(cartItemInputSchema.safeParse({ product_id: uuid, quantity: -1 }).success).toBe(false);
  });

  it('rejeita quantidade fracionária', () => {
    expect(cartItemInputSchema.safeParse({ product_id: uuid, quantity: 1.5 }).success).toBe(false);
  });

  it('rejeita product_id que não é uuid', () => {
    expect(cartItemInputSchema.safeParse({ product_id: 'abc', quantity: 1 }).success).toBe(false);
  });
});

// ---- constantes ---------------------------------------------------
describe('constantes de domínio', () => {
  it('todo status de pedido tem rótulo em PT-BR', () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
    }
  });

  it('PRODUCT_TYPES contém os tipos esperados', () => {
    expect(PRODUCT_TYPES).toContain('box');
    expect(PRODUCT_TYPES).toContain('single');
  });
});
