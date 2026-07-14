import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import type { Product as ProductModel } from '@legacystore/shared';
import { CatalogService } from '../catalog/catalog.service';
import { RecentlyViewedService } from '../../core/recently-viewed/recently-viewed.service';
import { ProductCard } from '../../shared/ui/product-card/product-card';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-product',
  imports: [RouterLink, MatIconModule, MatButtonModule, ProductCard, BrlPipe],
  templateUrl: './product.html',
})
export class Product {
  private readonly service = inject(CatalogService);
  private readonly recently = inject(RecentlyViewedService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly product = signal<ProductModel | null>(null);
  protected readonly related = signal<ProductModel[]>([]);
  protected readonly recentlyViewed = signal<ProductModel[]>([]);
  protected readonly activeImage = signal<string | null>(null);
  protected readonly quantity = signal(1);

  protected readonly images = computed(() => {
    const p = this.product();
    return [...(p?.images ?? [])].sort((a, b) => a.position - b.position);
  });

  protected readonly discount = computed(() => {
    const p = this.product();
    if (!p?.compare_at_price || p.compare_at_price <= p.price) return null;
    return Math.round((1 - p.price / p.compare_at_price) * 100);
  });

  protected readonly outOfStock = computed(() => (this.product()?.stock_quantity ?? 0) <= 0);
  protected readonly lowStock = computed(() => {
    const p = this.product();
    return !!p && p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold;
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) void this.load(slug);
    });
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.quantity.set(1);
    const product = await this.service.getProductBySlug(slug);

    if (!product) {
      void this.router.navigateByUrl('/produtos');
      return;
    }

    this.product.set(product);
    this.activeImage.set(
      [...(product.images ?? [])].sort((a, b) => a.position - b.position)[0]?.url ?? null,
    );
    this.recently.track(product.id);
    this.loading.set(false);

    // carrega relacionados e recém-vistos em paralelo
    const [related, recent] = await Promise.all([
      this.service.getRelatedProducts(product),
      this.recently.list(product.id),
    ]);
    this.related.set(related);
    this.recentlyViewed.set(recent);
  }

  protected changeQty(delta: number): void {
    const max = this.product()?.stock_quantity ?? 1;
    this.quantity.update((q) => Math.min(Math.max(1, q + delta), Math.max(1, max)));
  }

  protected addToCart(): void {
    // Carrinho entra na Fase 3. Placeholder por enquanto.
    // TODO(fase-3): integrar com CartService.
    console.info('add to cart', this.product()?.id, this.quantity());
  }
}
