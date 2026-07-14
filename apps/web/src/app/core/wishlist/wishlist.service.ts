import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Product } from '@legacystore/shared';
import { SupabaseService } from '../supabase/supabase.service';

const STORAGE_KEY = 'legacystore-wishlist';

/** Lista de desejos client-side (localStorage). Guarda ids de produtos. */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly supabase = inject(SupabaseService);

  private readonly ids = signal<string[]>(this.read());
  readonly count = computed(() => this.ids().length);

  constructor() {
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ids())));
  }

  private read(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  has(productId: string): boolean {
    return this.ids().includes(productId);
  }

  toggle(productId: string): void {
    this.ids.update((list) =>
      list.includes(productId) ? list.filter((id) => id !== productId) : [productId, ...list],
    );
  }

  remove(productId: string): void {
    this.ids.update((list) => list.filter((id) => id !== productId));
  }

  /** Carrega os produtos da lista (para a página de desejos). */
  async list(): Promise<Product[]> {
    const ids = this.ids();
    if (ids.length === 0) return [];
    const { data } = await this.supabase.client
      .from('products')
      .select('*, images:product_images(*)')
      .in('id', ids)
      .eq('is_active', true);
    const products = (data as Product[]) ?? [];
    return ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  }
}
