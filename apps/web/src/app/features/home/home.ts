import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Banner, Product } from '@legacystore/shared';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home {
  private readonly supabase = inject(SupabaseService);

  protected readonly banners = signal<Banner[]>([]);
  protected readonly featured = signal<Product[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [banners, featured] = await Promise.all([
      this.supabase.client
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('position'),
      this.supabase.client
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(8),
    ]);

    this.banners.set((banners.data as Banner[]) ?? []);
    this.featured.set((featured.data as Product[]) ?? []);
    this.loading.set(false);
  }

  protected priceBRL(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
