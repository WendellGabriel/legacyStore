import { inject, Injectable } from '@angular/core';
import type { Category, Product, ProductFormInput } from '@legacystore/shared';
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

  // ---- Categorias (para selects) ----
  async listCategories(): Promise<Category[]> {
    const { data } = await this.supabase.client
      .from('categories')
      .select('*')
      .order('position');
    return (data as Category[]) ?? [];
  }
}
