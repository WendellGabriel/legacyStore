import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import type { Product } from '@legacystore/shared';
import { WishlistService } from '../../core/wishlist/wishlist.service';
import { ProductCard } from '../../shared/ui/product-card/product-card';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, MatIconModule, MatButtonModule, ProductCard],
  templateUrl: './wishlist.html',
})
export class Wishlist {
  protected readonly wishlist = inject(WishlistService);
  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.products.set(await this.wishlist.list());
    this.loading.set(false);
  }
}
