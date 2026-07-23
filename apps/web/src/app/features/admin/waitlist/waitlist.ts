import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { ProductWaitlist } from '@legacystore/shared';
import { AdminService } from '../admin.service';

interface WaitlistGroup {
  productId: string;
  name: string;
  slug: string | null;
  items: ProductWaitlist[];
}

@Component({
  selector: 'app-admin-waitlist',
  imports: [RouterLink, MatIconModule],
  templateUrl: './waitlist.html',
})
export class Waitlist {
  private readonly admin = inject(AdminService);

  protected readonly entries = signal<ProductWaitlist[]>([]);
  protected readonly loading = signal(true);
  protected readonly onlyPending = signal(false);
  protected readonly autoPreorder = signal(false);
  protected readonly savingSetting = signal(false);

  /** Agrupa os interessados por produto, mais interessados primeiro. */
  protected readonly groups = computed<WaitlistGroup[]>(() => {
    const map = new Map<string, WaitlistGroup>();
    for (const e of this.entries()) {
      const key = e.product_id;
      if (!map.has(key)) {
        map.set(key, {
          productId: key,
          name: e.product?.name ?? '(produto removido)',
          slug: e.product?.slug ?? null,
          items: [],
        });
      }
      map.get(key)!.items.push(e);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  });

  protected readonly total = computed(() => this.entries().length);

  constructor() {
    void this.load();
    void this.loadSetting();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.entries.set(await this.admin.listWaitlist(this.onlyPending()));
    this.loading.set(false);
  }

  private async loadSetting(): Promise<void> {
    this.autoPreorder.set((await this.admin.getSetting<boolean>('auto_preorder_on_zero')) === true);
  }

  protected async togglePending(): Promise<void> {
    this.onlyPending.update((v) => !v);
    await this.load();
  }

  protected async toggleAuto(): Promise<void> {
    const next = !this.autoPreorder();
    this.savingSetting.set(true);
    const { error } = await this.admin.setSetting('auto_preorder_on_zero', next);
    this.savingSetting.set(false);
    if (!error) this.autoPreorder.set(next);
  }

  protected async markNotified(e: ProductWaitlist, notified: boolean): Promise<void> {
    const { error } = await this.admin.setWaitlistNotified(e.id, notified);
    if (!error) await this.load();
  }

  protected async remove(e: ProductWaitlist): Promise<void> {
    if (!confirm(`Remover ${e.email} da lista?`)) return;
    await this.admin.removeWaitlistEntry(e.id);
    await this.load();
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  /** Exporta os interessados atuais como CSV. */
  protected exportCsv(): void {
    const rows = [
      ['Produto', 'SKU', 'E-mail', 'WhatsApp', 'Data', 'Avisado'],
      ...this.entries().map((e) => [
        e.product?.name ?? '',
        e.product?.sku ?? '',
        e.email,
        e.whatsapp ?? '',
        this.date(e.created_at),
        e.notified_at ? 'sim' : 'não',
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pre-venda-interessados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
