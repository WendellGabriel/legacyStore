import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminService, DashboardStats } from '../admin.service';
import { BrlPipe } from '../../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, MatIconModule, BrlPipe],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly admin = inject(AdminService);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly loading = signal(true);

  // barras do gráfico normalizadas (0-100%)
  protected readonly chart = computed(() => {
    const days = this.stats()?.revenue_last_7_days ?? [];
    const max = Math.max(1, ...days.map((d) => Number(d.total)));
    return days.map((d) => ({
      date: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }),
      total: Number(d.total),
      pct: Math.round((Number(d.total) / max) * 100),
    }));
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.stats.set(await this.admin.dashboard());
    this.loading.set(false);
  }
}
