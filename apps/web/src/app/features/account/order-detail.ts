import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { Order, OrderStatus } from '@legacystore/shared';
import { ORDER_STATUS_LABELS } from '@legacystore/shared';
import { OrderService } from './order.service';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, MatIconModule, BrlPipe],
  templateUrl: './order-detail.html',
})
export class OrderDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);

  protected readonly order = signal<Order | null>(null);
  protected readonly history = signal<{ to_status: string; created_at: string }[]>([]);
  protected readonly loading = signal(true);
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  constructor() {
    const number = this.route.snapshot.paramMap.get('orderNumber');
    if (number) void this.load(number);
    else this.loading.set(false);
  }

  private async load(number: string): Promise<void> {
    const order = await this.orderService.getByNumber(number);
    this.order.set(order);
    if (order) this.history.set(await this.orderService.getStatusHistory(order.id));
    this.loading.set(false);
  }

  protected label(status: string): string {
    return this.statusLabels[status as OrderStatus] ?? status;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
