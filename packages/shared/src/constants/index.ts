// Constantes de domínio — espelham os enums do Postgres (supabase/migrations/0001)

export const USER_ROLES = ['customer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRODUCT_TYPES = ['box', 'single', 'accessory', 'sealed'] as const;
export type ProductTypeValue = (typeof PRODUCT_TYPES)[number];

export const RELATION_TYPES = ['related', 'cross_sell', 'up_sell'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'refunded',
  'chargeback',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['pix', 'card', 'boleto', 'manual'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SHIPPING_METHODS = ['recife_zone', 'correios'] as const;
export type ShippingMethodValue = (typeof SHIPPING_METHODS)[number];

// Rótulos em PT-BR para exibição no admin/cliente
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  processing: 'Em separação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const;
export type BrazilState = (typeof BRAZIL_STATES)[number];
