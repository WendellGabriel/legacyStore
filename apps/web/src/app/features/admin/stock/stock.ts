import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { Product } from '@legacystore/shared';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-admin-stock',
  imports: [FormsModule, MatIconModule],
  templateUrl: './stock.html',
})
export class Stock {
  private readonly admin = inject(AdminService);

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly editing = signal<string | null>(null);
  protected readonly delta = signal(0);
  protected readonly reason = signal('');
  protected readonly saving = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.products.set(await this.admin.listProducts());
    this.loading.set(false);
  }

  open(id: string): void {
    this.editing.set(id);
    this.delta.set(0);
    this.reason.set('');
  }

  async apply(product: Product): Promise<void> {
    if (this.delta() === 0) return;
    this.saving.set(true);
    const { error } = await this.admin.restock(product.id, this.delta(), this.reason() || 'Ajuste manual');
    this.saving.set(false);
    if (!error) {
      this.editing.set(null);
      await this.load();
    }
  }

  protected level(p: Product): 'out' | 'low' | 'ok' {
    if (p.stock_quantity === 0) return 'out';
    if (p.stock_quantity <= p.low_stock_threshold) return 'low';
    return 'ok';
  }
}
