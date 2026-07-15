import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { Order, OrderStatus } from '@legacystore/shared';
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from '@legacystore/shared';
import { AdminService } from '../admin.service';
import { BrlPipe } from '../../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-admin-order-detail',
  imports: [RouterLink, FormsModule, MatIconModule, BrlPipe],
  templateUrl: './admin-order-detail.html',
})
export class AdminOrderDetail {
  private readonly admin = inject(AdminService);
  private readonly route = inject(ActivatedRoute);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly savedMsg = signal<string | null>(null);
  protected readonly statuses = ORDER_STATUSES;
  protected readonly labels = ORDER_STATUS_LABELS;

  protected readonly status = signal<OrderStatus>('pending');
  protected readonly tracking = signal('');

  constructor() {
    const number = this.route.snapshot.paramMap.get('orderNumber');
    if (number) void this.load(number);
    else this.loading.set(false);
  }

  private async load(number: string): Promise<void> {
    const o = await this.admin.getOrder(number);
    this.order.set(o);
    if (o) {
      this.status.set(o.status);
      this.tracking.set(o.tracking_code ?? '');
    }
    this.loading.set(false);
  }

  async save(): Promise<void> {
    const o = this.order();
    if (!o) return;
    this.saving.set(true);
    this.savedMsg.set(null);
    const { error } = await this.admin.updateOrder(o.id, {
      status: this.status(),
      tracking_code: this.tracking() || null,
    });
    this.saving.set(false);
    if (!error) {
      this.savedMsg.set('Alterações salvas.');
      await this.load(o.order_number);
      setTimeout(() => this.savedMsg.set(null), 2500);
    }
  }

  /** Marca como pago manualmente (pagamento fora do sistema). */
  async markPaid(): Promise<void> {
    const o = this.order();
    if (!o) return;
    this.saving.set(true);
    await this.admin.updateOrder(o.id, { payment_status: 'approved', status: 'paid' });
    this.saving.set(false);
    await this.load(o.order_number);
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }
}
