// Schemas Zod — validação usada tanto no Angular (Reactive Forms) quanto
// no Hono (validação de request). Fonte única de verdade das regras.

import { z } from 'zod';
import { BRAZIL_STATES, PRODUCT_TYPES } from '../constants';

// CEP brasileiro: 8 dígitos (com ou sem hífen) --------------------
export const cepSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 8, 'CEP inválido');

// Endereço -------------------------------------------------------
export const addressSchema = z.object({
  label: z.string().max(40).optional(),
  recipient: z.string().min(2, 'Informe o destinatário'),
  cep: cepSchema,
  street: z.string().min(2, 'Informe a rua'),
  number: z.string().min(1, 'Informe o número'),
  complement: z.string().max(60).optional(),
  neighborhood: z.string().min(2, 'Informe o bairro'),
  city: z.string().min(2, 'Informe a cidade'),
  state: z.enum(BRAZIL_STATES),
  is_default: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

// Cadastro / Login -----------------------------------------------
export const signUpSchema = z.object({
  full_name: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone inválido').optional(),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});
export type SignInInput = z.infer<typeof signInSchema>;

// Item do carrinho / checkout ------------------------------------
export const cartItemInputSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

// Cálculo de frete -----------------------------------------------
export const shippingQuoteSchema = z.object({
  cep: cepSchema,
  items: z.array(cartItemInputSchema).min(1),
});
export type ShippingQuoteInput = z.infer<typeof shippingQuoteSchema>;

// Checkout -------------------------------------------------------
export const checkoutSchema = z.object({
  items: z.array(cartItemInputSchema).min(1, 'Carrinho vazio'),
  address: addressSchema,
  shipping_method: z.enum(['recife_zone', 'correios']),
  shipping_service: z.string(),
  shipping_total: z.number().nonnegative(),
  shipping_days: z.number().int().nonnegative(),
  coupon_code: z.string().optional(),
  customer_email: z.string().email(),
  customer_phone: z.string().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// Produto (admin) ------------------------------------------------
export const productFormSchema = z.object({
  sku: z.string().min(1, 'SKU obrigatório'),
  name: z.string().min(2, 'Nome obrigatório'),
  slug: z.string().min(2),
  description: z.string().optional(),
  category_id: z.string().uuid().nullable(),
  product_type: z.enum(PRODUCT_TYPES),
  price: z.number().nonnegative('Preço inválido'),
  compare_at_price: z.number().nonnegative().nullable().optional(),
  stock_quantity: z.number().int().nonnegative(),
  low_stock_threshold: z.number().int().nonnegative().default(5),
  weight_grams: z.number().int().nonnegative().nullable().optional(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export type ProductFormInput = z.infer<typeof productFormSchema>;
