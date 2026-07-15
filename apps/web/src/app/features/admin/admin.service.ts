import { inject, Injectable } from '@angular/core';
import type {
  Banner,
  Category,
  Coupon,
  Order,
  OrderStatus,
  Product,
  ProductFormInput,
  Profile,
  ShippingZone,
} from '@legacystore/shared';
import { SupabaseService } from '../../core/supabase/supabase.service';

export interface DashboardStats {
  revenue: number;
  paid_orders: number;
  pending_orders: number;
  total_orders: number;
  total_products: number;
  total_customers: number;
  low_stock: number;
  out_of_stock: number;
  revenue_last_7_days: { date: string; total: number }[];
  top_products: { name: string; sold: number }[];
}

const PRODUCTS_BUCKET = 'products';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly supabase = inject(SupabaseService);

  // ---- Dashboard ----
  async dashboard(): Promise<DashboardStats | null> {
    const { data } = await this.supabase.client.rpc('admin_dashboard_stats');
    return (data as DashboardStats) ?? null;
  }

  // ---- Produtos ----
  async listProducts(search?: string): Promise<Product[]> {
    let q = this.supabase.client
      .from('products')
      .select('*, images:product_images(*), category:categories(name)')
      .order('created_at', { ascending: false });
    if (search) q = q.ilike('name', `%${search}%`);
    const { data } = await q;
    return (data as Product[]) ?? [];
  }

  async getProduct(id: string): Promise<Product | null> {
    const { data } = await this.supabase.client
      .from('products')
      .select('*, images:product_images(*)')
      .eq('id', id)
      .maybeSingle();
    return (data as Product) ?? null;
  }

  async createProduct(input: ProductFormInput): Promise<{ id?: string; error?: string }> {
    const { data, error } = await this.supabase.client
      .from('products')
      .insert(input)
      .select('id')
      .single();
    if (error) return { error: error.message };
    return { id: (data as { id: string }).id };
  }

  async updateProduct(id: string, input: Partial<ProductFormInput>): Promise<{ error?: string }> {
    const { error } = await this.supabase.client.from('products').update(input).eq('id', id);
    return { error: error?.message };
  }

  async deleteProduct(id: string): Promise<void> {
    await this.supabase.client.from('products').delete().eq('id', id);
  }

  // ---- Imagens (Supabase Storage) ----
  async uploadImage(productId: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.supabase.client.storage
      .from(PRODUCTS_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = this.supabase.client.storage.from(PRODUCTS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async addProductImage(productId: string, url: string, position: number): Promise<void> {
    await this.supabase.client
      .from('product_images')
      .insert({ product_id: productId, url, position });
  }

  async removeProductImage(imageId: string): Promise<void> {
    await this.supabase.client.from('product_images').delete().eq('id', imageId);
  }

  // ---- Categorias ----
  async listCategories(): Promise<Category[]> {
    const { data } = await this.supabase.client
      .from('categories')
      .select('*')
      .order('position');
    return (data as Category[]) ?? [];
  }

  async saveCategory(input: Partial<Category>, id?: string): Promise<{ error?: string }> {
    const q = id
      ? this.supabase.client.from('categories').update(input).eq('id', id)
      : this.supabase.client.from('categories').insert(input);
    const { error } = await q;
    return { error: error?.message };
  }

  async deleteCategory(id: string): Promise<void> {
    await this.supabase.client.from('categories').delete().eq('id', id);
  }

  // ---- Pedidos ----
  async listOrders(status?: string): Promise<Order[]> {
    let q = this.supabase.client
      .from('orders')
      .select('*, items:order_items(*)')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return (data as Order[]) ?? [];
  }

  async getOrder(orderNumber: string): Promise<Order | null> {
    const { data } = await this.supabase.client
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('order_number', orderNumber)
      .maybeSingle();
    return (data as Order) ?? null;
  }

  async updateOrder(
    id: string,
    patch: Partial<Pick<Order, 'status' | 'payment_status' | 'tracking_code' | 'notes'>>,
  ): Promise<{ error?: string }> {
    const { error } = await this.supabase.client.from('orders').update(patch).eq('id', id);
    return { error: error?.message };
  }

  // ---- Estoque ----
  async restock(productId: string, delta: number, reason: string): Promise<{ error?: string }> {
    const { error } = await this.supabase.client.rpc('adjust_stock', {
      p_product_id: productId,
      p_delta: delta,
      p_type: delta >= 0 ? 'restock' : 'adjustment',
      p_reason: reason,
    });
    return { error: error?.message };
  }

  async stockMovements(productId?: string): Promise<
    { id: string; type: string; quantity_delta: number; reason: string | null; created_at: string; product_id: string }[]
  > {
    let q = this.supabase.client
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (productId) q = q.eq('product_id', productId);
    const { data } = await q;
    return (data as never) ?? [];
  }

  // ---- Banners ----
  async listBanners(): Promise<Banner[]> {
    const { data } = await this.supabase.client.from('banners').select('*').order('position');
    return (data as Banner[]) ?? [];
  }

  async saveBanner(input: Partial<Banner>, id?: string): Promise<{ error?: string }> {
    const q = id
      ? this.supabase.client.from('banners').update(input).eq('id', id)
      : this.supabase.client.from('banners').insert(input);
    const { error } = await q;
    return { error: error?.message };
  }

  async deleteBanner(id: string): Promise<void> {
    await this.supabase.client.from('banners').delete().eq('id', id);
  }

  // ---- Cupons ----
  async listCoupons(): Promise<Coupon[]> {
    const { data } = await this.supabase.client
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    return (data as Coupon[]) ?? [];
  }

  async saveCoupon(input: Partial<Coupon>, id?: string): Promise<{ error?: string }> {
    const q = id
      ? this.supabase.client.from('coupons').update(input).eq('id', id)
      : this.supabase.client.from('coupons').insert(input);
    const { error } = await q;
    return { error: error?.message };
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.supabase.client.from('coupons').delete().eq('id', id);
  }

  // ---- Zonas de frete ----
  async listShippingZones(): Promise<ShippingZone[]> {
    const { data } = await this.supabase.client
      .from('shipping_zones')
      .select('*')
      .order('city');
    return (data as ShippingZone[]) ?? [];
  }

  async saveShippingZone(input: Partial<ShippingZone>, id?: string): Promise<{ error?: string }> {
    const q = id
      ? this.supabase.client.from('shipping_zones').update(input).eq('id', id)
      : this.supabase.client.from('shipping_zones').insert(input);
    const { error } = await q;
    return { error: error?.message };
  }

  async deleteShippingZone(id: string): Promise<void> {
    await this.supabase.client.from('shipping_zones').delete().eq('id', id);
  }

  // ---- Clientes ----
  async listCustomers(): Promise<Profile[]> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return (data as Profile[]) ?? [];
  }
}
