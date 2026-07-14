import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CartService } from '../../core/cart/cart.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, FormsModule, MatIconModule, MatButtonModule, BrlPipe],
  templateUrl: './cart.html',
})
export class Cart {
  protected readonly cart = inject(CartService);
  private readonly supabase = inject(SupabaseService);

  protected readonly couponCode = signal('');
  protected readonly appliedCoupon = signal<{ code: string; discount: number } | null>(null);
  protected readonly couponError = signal<string | null>(null);
  protected readonly couponLoading = signal(false);

  protected readonly discount = computed(() => this.appliedCoupon()?.discount ?? 0);
  protected readonly total = computed(() => Math.max(0, this.cart.subtotal() - this.discount()));

  async applyCoupon(): Promise<void> {
    const code = this.couponCode().trim();
    if (!code) return;
    this.couponError.set(null);
    this.couponLoading.set(true);

    const { data, error } = await this.supabase.client.rpc('validate_coupon', {
      p_code: code,
      p_order_total: this.cart.subtotal(),
    });
    this.couponLoading.set(false);

    const result = data as { valid: boolean; reason?: string; discount?: number } | null;
    if (error || !result?.valid) {
      this.appliedCoupon.set(null);
      this.couponError.set(result?.reason ?? 'Cupom inválido');
      return;
    }
    this.appliedCoupon.set({ code, discount: result.discount ?? 0 });
  }

  removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponCode.set('');
    this.couponError.set(null);
  }
}
