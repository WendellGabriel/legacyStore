import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import type { Order, OrderStatus } from '@legacystore/shared';
import { ORDER_STATUS_LABELS } from '@legacystore/shared';
import { OrderService } from './order.service';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-orders',
  imports: [RouterLink, MatIconModule, MatButtonModule, BrlPipe],
  templateUrl: './orders.html',
})
export class Orders {
  private readonly orderService = inject(OrderService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  // cores por status (badge)
  protected readonly statusStyle: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    processing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    shipped: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    refunded: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
  };

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.orders.set(await this.orderService.listMine());
    this.loading.set(false);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
