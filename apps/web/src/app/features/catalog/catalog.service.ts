import { inject, Injectable } from '@angular/core';
import type { Category, Product, ProductTypeValue } from '@legacystore/shared';
import { SupabaseService } from '../../core/supabase/supabase.service';

export interface CatalogFilters {
  categorySlug?: string; // categoria-raiz (jogo) ou subcategoria
  search?: string;
  productType?: ProductTypeValue;
  minPrice?: number;
  maxPrice?: number;
  onlyInStock?: boolean;
  onSale?: boolean;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'name';
  page?: number;
  pageSize?: number;
}

export interface CatalogResult {
  products: Product[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly supabase = inject(SupabaseService);

  /** Lista todas as categorias ativas (para menu e filtros). */
  async listCategories(): Promise<Category[]> {
    const { data } = await this.supabase.client
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('position');
    return (data as Category[]) ?? [];
  }

  /** Busca uma categoria pelo slug (com seus filhos, se houver). */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const { data } = await this.supabase.client
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    return (data as Category) ?? null;
  }

  /** Lista produtos aplicando filtros, ordenação e paginação. */
  async listProducts(filters: CatalogFilters): Promise<CatalogResult> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 12;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase.client
      .from('products')
      .select('*, images:product_images(*), category:categories(id, name, slug)', {
        count: 'exact',
      })
      .eq('is_active', true);

    // categoria: aceita a raiz (jogo) e suas subcategorias
    if (filters.categorySlug) {
      const category = await this.getCategoryBySlug(filters.categorySlug);
      if (category) {
        const { data: children } = await this.supabase.client
          .from('categories')
          .select('id')
          .eq('parent_id', category.id);
        const ids = [category.id, ...((children as { id: string }[]) ?? []).map((c) => c.id)];
        query = query.in('category_id', ids);
      }
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }
    if (filters.productType) {
      query = query.eq('product_type', filters.productType);
    }
    if (filters.minPrice != null) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice != null) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters.onlyInStock) {
      query = query.gt('stock_quantity', 0);
    }
    if (filters.onSale) {
      query = query.not('compare_at_price', 'is', null);
    }

    switch (filters.sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, count } = await query.range(from, to);
    return { products: (data as Product[]) ?? [], total: count ?? 0 };
  }

  /** Busca um produto completo pelo slug (imagens + categoria). */
  async getProductBySlug(slug: string): Promise<Product | null> {
    const { data } = await this.supabase.client
      .from('products')
      .select('*, images:product_images(*), category:categories(id, name, slug)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    return (data as Product) ?? null;
  }

  /** Produtos relacionados (relação explícita + fallback pela mesma categoria). */
  async getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
    const { data: relations } = await this.supabase.client
      .from('product_relations')
      .select('related:products!product_relations_related_id_fkey(*, images:product_images(*))')
      .eq('product_id', product.id)
      .order('position');

    const related = ((relations as unknown as { related: Product }[]) ?? [])
      .map((r) => r.related)
      .filter((p) => p?.is_active);

    if (related.length >= limit) return related.slice(0, limit);

    // completa com produtos da mesma categoria
    if (product.category_id) {
      const { data } = await this.supabase.client
        .from('products')
        .select('*, images:product_images(*)')
        .eq('is_active', true)
        .eq('category_id', product.category_id)
        .neq('id', product.id)
        .limit(limit);
      const extras = (data as Product[]) ?? [];
      const seen = new Set(related.map((p) => p.id));
      for (const p of extras) {
        if (related.length >= limit) break;
        if (!seen.has(p.id)) related.push(p);
      }
    }
    return related.slice(0, limit);
  }
}
