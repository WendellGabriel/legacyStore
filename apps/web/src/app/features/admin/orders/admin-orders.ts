import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { Order, OrderStatus } from '@legacystore/shared';
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from '@legacystore/shared';
import { AdminService } from '../admin.service';
import { BrlPipe } from '../../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-admin-orders',
  imports: [RouterLink, MatIconModule, BrlPipe],
  templateUrl: './admin-orders.html',
})
export class AdminOrders {
  private readonly admin = inject(AdminService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly filter = signal<string>('');
  protected readonly statuses = ORDER_STATUSES;
  protected readonly labels = ORDER_STATUS_LABELS;

  protected readonly badge: Record<OrderStatus, string> = {
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

  async load(): Promise<void> {
    this.loading.set(true);
    this.orders.set(await this.admin.listOrders(this.filter() || undefined));
    this.loading.set(false);
  }

  setFilter(status: string): void {
    this.filter.set(status);
    void this.load();
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
}
