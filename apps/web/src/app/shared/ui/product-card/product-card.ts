import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { isPreorder, type Product } from '@legacystore/shared';
import { BrlPipe } from '../../pipes/brl.pipe';
import { CartService } from '../../../core/cart/cart.service';
import { WishlistService } from '../../../core/wishlist/wishlist.service';
import { SettingsService } from '../../../core/settings/settings.service';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, MatIconModule, BrlPipe],
  templateUrl: './product-card.html',
})
export class ProductCard {
  readonly product = input.required<Product>();

  protected readonly cart = inject(CartService);
  protected readonly wishlist = inject(WishlistService);
  private readonly settings = inject(SettingsService);

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
  protected readonly preorder = computed(() =>
    isPreorder(this.product(), this.settings.get<boolean>('auto_preorder_on_zero', false)),
  );

  protected addToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cart.add(this.product(), 1);
  }

  protected toggleWishlist(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.wishlist.toggle(this.product().id);
  }
}
