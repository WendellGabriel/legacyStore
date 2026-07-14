import { inject, Injectable } from '@angular/core';
import type { Product } from '@legacystore/shared';
import { SupabaseService } from '../supabase/supabase.service';

const STORAGE_KEY = 'legacystore-recently-viewed';
const MAX = 12;

/** Guarda os últimos produtos visualizados (por id) no localStorage. */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly supabase = inject(SupabaseService);

  private read(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  /** Registra um produto como visto (move para o topo). */
  track(productId: string): void {
    const ids = this.read().filter((id) => id !== productId);
    ids.unshift(productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX)));
  }

  /** Carrega os produtos vistos (exceto o atual), preservando a ordem. */
  async list(excludeId?: string, limit = 6): Promise<Product[]> {
    const ids = this.read().filter((id) => id !== excludeId).slice(0, limit);
    if (ids.length === 0) return [];

    const { data } = await this.supabase.client
      .from('products')
      .select('*, images:product_images(*)')
      .in('id', ids)
      .eq('is_active', true);

    const products = (data as Product[]) ?? [];
    // reordena conforme a ordem de visualização
    return ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  }
}
