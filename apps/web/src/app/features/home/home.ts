import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Banner, Product } from '@legacystore/shared';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ProductCard } from '../../shared/ui/product-card/product-card';
import { Carousel } from '../../shared/ui/carousel/carousel';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, Carousel],
  templateUrl: './home.html',
})
export class Home {
  private readonly supabase = inject(SupabaseService);

  protected readonly banners = signal<Banner[]>([]);
  protected readonly featured = signal<Product[]>([]);
  protected readonly onSale = signal<Product[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const select = '*, images:product_images(*)';
    const [banners, featured, onSale] = await Promise.all([
      this.supabase.client.from('banners').select('*').eq('is_active', true).order('position'),
      this.supabase.client
        .from('products')
        .select(select)
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(8),
      this.supabase.client
        .from('products')
        .select(select)
        .eq('is_active', true)
        .not('compare_at_price', 'is', null)
        .limit(4),
    ]);

    this.banners.set((banners.data as Banner[]) ?? []);
    this.featured.set((featured.data as Product[]) ?? []);
    this.onSale.set((onSale.data as Product[]) ?? []);
    this.loading.set(false);
  }
}
