import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product } from '@legacystore/shared';
import { BrlPipe } from '../../pipes/brl.pipe';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, BrlPipe],
  templateUrl: './product-card.html',
})
export class ProductCard {
  readonly product = input.required<Product>();

  protected readonly image = computed(() => {
    const imgs = this.product().images ?? [];
    const sorted = [...imgs].sort((a, b) => a.position - b.position);
    return sorted[0]?.url ?? null;
  });

  protected readonly discount = computed(() => {
    const p = this.product();
    if (!p.compare_at_price || p.compare_at_price <= p.price) return null;
    return Math.round((1 - p.price / p.compare_at_price) * 100);
  });

  protected readonly outOfStock = computed(() => this.product().stock_quantity <= 0);
}
