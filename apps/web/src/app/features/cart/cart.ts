import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CartService } from '../../core/cart/cart.service';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, FormsModule, MatIconModule, MatButtonModule, BrlPipe],
  templateUrl: './cart.html',
})
export class Cart {
  protected readonly cart = inject(CartService);

  protected readonly couponInput = signal('');
  protected readonly couponError = signal<string | null>(null);
  protected readonly couponLoading = signal(false);

  async applyCoupon(): Promise<void> {
    this.couponError.set(null);
    this.couponLoading.set(true);
    const error = await this.cart.applyCoupon(this.couponInput());
    this.couponLoading.set(false);
    this.couponError.set(error);
  }

  removeCoupon(): void {
    this.cart.clearCoupon();
    this.couponInput.set('');
    this.couponError.set(null);
  }
}
