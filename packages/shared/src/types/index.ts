// Tipos de domínio compartilhados entre apps/web e apps/api.
// Espelham as tabelas de supabase/migrations.

import type {
  UserRole,
  ProductTypeValue,
  RelationType,
  DiscountType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ShippingMethodValue,
} from '../constants';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  position: number;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  product_type: ProductTypeValue;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  is_featured: boolean;
  is_active: boolean;
  allow_preorder: boolean; // pré-venda manual (admin liga por produto)
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
  // relações opcionais (quando carregadas via join)
  images?: ProductImage[];
  category?: Category;
}

/** Registro de interesse na pré-venda de um produto esgotado. */
export interface ProductWaitlist {
  id: string;
  product_id: string;
  user_id: string | null;
  email: string;
  whatsapp: string | null;
  notified_at: string | null;
  created_at: string;
  // relação opcional (quando carregada via join no admin)
  product?: Pick<Product, 'id' | 'name' | 'slug' | 'sku'>;
}

export interface ProductRelation {
  id: string;
  product_id: string;
  related_id: string;
  relation_type: RelationType;
  position: number;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  is_approved: boolean;
  created_at: string;
}

export interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  mobile_image_url: string | null;
  link_url: string | null;
  position: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: DiscountType;
  value: number;
  min_order_total: number;
  max_uses: number | null;
  used_count: number;
  per_user_limit: number;
  is_active: boolean;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  unit_price_snapshot: number;
  product?: Product;
}

export interface Cart {
  id: string;
  user_id: string | null;
  session_id: string | null;
  items?: CartItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name_snapshot: string;
  sku_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  status: OrderStatus;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  grand_total: number;
  coupon_id: string | null;
  shipping_address: Address;
  shipping_method: ShippingMethodValue;
  shipping_service: string | null;
  shipping_days: number | null;
  tracking_code: string | null;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface ShippingZone {
  id: string;
  city: string;
  neighborhood: string;
  price: number;
  delivery_days: number;
  is_active: boolean;
}

// Resultado do cálculo de frete (API)
export interface ShippingQuote {
  method: ShippingMethodValue;
  service: string;
  price: number;
  delivery_days: number;
}
