import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { Banner } from '@legacystore/shared';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-admin-banners',
  imports: [FormsModule, MatIconModule],
  templateUrl: './banners.html',
})
export class Banners {
  private readonly admin = inject(AdminService);

  protected readonly items = signal<Banner[]>([]);
  protected readonly loading = signal(true);
  protected readonly showForm = signal(false);
  protected readonly editing = signal<Banner | null>(null);

  protected readonly title = signal('');
  protected readonly imageUrl = signal('');
  protected readonly linkUrl = signal('');
  protected readonly position = signal(0);
  protected readonly isActive = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.items.set(await this.admin.listBanners());
    this.loading.set(false);
  }

  openNew(): void {
    this.editing.set(null);
    this.title.set(''); this.imageUrl.set(''); this.linkUrl.set(''); this.position.set(0); this.isActive.set(true);
    this.showForm.set(true);
  }

  openEdit(b: Banner): void {
    this.editing.set(b);
    this.title.set(b.title ?? ''); this.imageUrl.set(b.image_url); this.linkUrl.set(b.link_url ?? '');
    this.position.set(b.position); this.isActive.set(b.is_active);
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (!this.imageUrl()) return;
    await this.admin.saveBanner(
      {
        title: this.title() || null,
        image_url: this.imageUrl(),
        link_url: this.linkUrl() || null,
        position: this.position(),
        is_active: this.isActive(),
      },
      this.editing()?.id,
    );
    this.showForm.set(false);
    await this.load();
  }

  async remove(b: Banner): Promise<void> {
    if (!confirm('Excluir banner?')) return;
    await this.admin.deleteBanner(b.id);
    await this.load();
  }
}
