import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { Coupon, DiscountType } from '@legacystore/shared';
import { AdminService } from '../admin.service';
import { BrlPipe } from '../../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-admin-coupons',
  imports: [FormsModule, MatIconModule, BrlPipe],
  templateUrl: './coupons.html',
})
export class Coupons {
  private readonly admin = inject(AdminService);

  protected readonly items = signal<Coupon[]>([]);
  protected readonly loading = signal(true);
  protected readonly showForm = signal(false);
  protected readonly editing = signal<Coupon | null>(null);

  protected readonly code = signal('');
  protected readonly type = signal<DiscountType>('percentage');
  protected readonly value = signal(0);
  protected readonly minOrder = signal(0);
  protected readonly maxUses = signal<number | null>(null);
  protected readonly isActive = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.items.set(await this.admin.listCoupons());
    this.loading.set(false);
  }

  openNew(): void {
    this.editing.set(null);
    this.code.set(''); this.type.set('percentage'); this.value.set(0);
    this.minOrder.set(0); this.maxUses.set(null); this.isActive.set(true);
    this.showForm.set(true);
  }

  openEdit(c: Coupon): void {
    this.editing.set(c);
    this.code.set(c.code); this.type.set(c.discount_type); this.value.set(c.value);
    this.minOrder.set(c.min_order_total); this.maxUses.set(c.max_uses); this.isActive.set(c.is_active);
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (!this.code()) return;
    await this.admin.saveCoupon(
      {
        code: this.code().toUpperCase(),
        discount_type: this.type(),
        value: this.value(),
        min_order_total: this.minOrder(),
        max_uses: this.maxUses(),
        is_active: this.isActive(),
      },
      this.editing()?.id,
    );
    this.showForm.set(false);
    await this.load();
  }

  async remove(c: Coupon): Promise<void> {
    if (!confirm(`Excluir cupom "${c.code}"?`)) return;
    await this.admin.deleteCoupon(c.id);
    await this.load();
  }
}
