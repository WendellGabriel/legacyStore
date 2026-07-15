import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { ShippingZone } from '@legacystore/shared';
import { AdminService } from '../admin.service';
import { BrlPipe } from '../../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-admin-shipping-zones',
  imports: [FormsModule, MatIconModule, BrlPipe],
  templateUrl: './shipping-zones.html',
})
export class ShippingZones {
  private readonly admin = inject(AdminService);

  protected readonly items = signal<ShippingZone[]>([]);
  protected readonly loading = signal(true);
  protected readonly showForm = signal(false);
  protected readonly editing = signal<ShippingZone | null>(null);

  protected readonly city = signal('Recife');
  protected readonly neighborhood = signal('');
  protected readonly price = signal(0);
  protected readonly days = signal(1);
  protected readonly isActive = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.items.set(await this.admin.listShippingZones());
    this.loading.set(false);
  }

  openNew(): void {
    this.editing.set(null);
    this.city.set('Recife'); this.neighborhood.set(''); this.price.set(0); this.days.set(1); this.isActive.set(true);
    this.showForm.set(true);
  }

  openEdit(z: ShippingZone): void {
    this.editing.set(z);
    this.city.set(z.city); this.neighborhood.set(z.neighborhood); this.price.set(z.price);
    this.days.set(z.delivery_days); this.isActive.set(z.is_active);
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (!this.city() || !this.neighborhood()) return;
    await this.admin.saveShippingZone(
      {
        city: this.city(),
        neighborhood: this.neighborhood(),
        price: this.price(),
        delivery_days: this.days(),
        is_active: this.isActive(),
      },
      this.editing()?.id,
    );
    this.showForm.set(false);
    await this.load();
  }

  async remove(z: ShippingZone): Promise<void> {
    if (!confirm(`Excluir zona "${z.neighborhood}, ${z.city}"?`)) return;
    await this.admin.deleteShippingZone(z.id);
    await this.load();
  }
}
