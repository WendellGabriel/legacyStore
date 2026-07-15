import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { Profile } from '@legacystore/shared';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-admin-customers',
  imports: [FormsModule, MatIconModule],
  templateUrl: './customers.html',
})
export class Customers {
  private readonly admin = inject(AdminService);

  protected readonly all = signal<Profile[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');

  protected readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.all();
    return this.all().filter(
      (c) => (c.full_name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q),
    );
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.all.set(await this.admin.listCustomers());
    this.loading.set(false);
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }
}
