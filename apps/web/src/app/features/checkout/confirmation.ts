import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { Order } from '@legacystore/shared';
import { ORDER_STATUS_LABELS } from '@legacystore/shared';
import { OrderService } from '../account/order.service';
import { PaymentService } from './payment.service';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-confirmation',
  imports: [RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, BrlPipe],
  templateUrl: './confirmation.html',
})
export class Confirmation {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);
  private readonly payment = inject(PaymentService);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly devMode = signal(false);
  protected readonly confirming = signal(false);
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  // status vindo do retorno do Mercado Pago (?status=)
  protected readonly returnStatus = signal<string | null>(null);

  protected readonly isPaid = computed(() => this.order()?.payment_status === 'approved');
  protected readonly isPending = computed(() => this.order()?.payment_status === 'pending');

  constructor() {
    this.returnStatus.set(this.route.snapshot.queryParamMap.get('status'));
    const number = this.route.snapshot.paramMap.get('orderNumber');
    if (number) void this.load(number);
    else this.loading.set(false);
  }

  private async load(number: string): Promise<void> {
    const [order, mode] = await Promise.all([
      this.orderService.getByNumber(number),
      fetch('/api/payments/mode').then((r) => r.json()).catch(() => ({ dev: false })),
    ]);
    this.order.set(order);
    this.devMode.set(!!mode.dev);
    this.loading.set(false);
  }

  /** Modo dev: simula a aprovação do pagamento. */
  async simulatePayment(): Promise<void> {
    const number = this.order()?.order_number;
    if (!number) return;
    this.confirming.set(true);
    const ok = await this.payment.devConfirm(number);
    if (ok) await this.load(number);
    this.confirming.set(false);
  }
}
