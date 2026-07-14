import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import type { Order } from '@legacystore/shared';
import { ORDER_STATUS_LABELS } from '@legacystore/shared';
import { OrderService } from '../account/order.service';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-confirmation',
  imports: [RouterLink, MatIconModule, MatButtonModule, BrlPipe],
  templateUrl: './confirmation.html',
})
export class Confirmation {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly statusLabels = ORDER_STATUS_LABELS;

  constructor() {
    const number = this.route.snapshot.paramMap.get('orderNumber');
    if (number) void this.load(number);
    else this.loading.set(false);
  }

  private async load(number: string): Promise<void> {
    this.order.set(await this.orderService.getByNumber(number));
    this.loading.set(false);
  }
}
