import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { Category } from '@legacystore/shared';
import { AdminService } from '../admin.service';

function slugify(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

@Component({
  selector: 'app-admin-categories',
  imports: [FormsModule, MatIconModule],
  templateUrl: './categories.html',
})
export class Categories {
  private readonly admin = inject(AdminService);

  protected readonly items = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly editing = signal<Category | null>(null);
  protected readonly showForm = signal(false);

  protected readonly name = signal('');
  protected readonly slug = signal('');
  protected readonly parentId = signal<string>('');
  protected readonly position = signal(0);
  protected readonly isActive = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.items.set(await this.admin.listCategories());
    this.loading.set(false);
  }

  parentName(id: string | null): string {
    return id ? (this.items().find((c) => c.id === id)?.name ?? '—') : '—';
  }

  openNew(): void {
    this.editing.set(null);
    this.name.set(''); this.slug.set(''); this.parentId.set(''); this.position.set(0); this.isActive.set(true);
    this.showForm.set(true);
  }

  openEdit(c: Category): void {
    this.editing.set(c);
    this.name.set(c.name); this.slug.set(c.slug); this.parentId.set(c.parent_id ?? '');
    this.position.set(c.position); this.isActive.set(c.is_active);
    this.showForm.set(true);
  }

  onName(v: string): void {
    this.name.set(v);
    if (!this.editing() && !this.slug()) this.slug.set(slugify(v));
  }

  async save(): Promise<void> {
    if (!this.name() || !this.slug()) return;
    await this.admin.saveCategory(
      {
        name: this.name(),
        slug: this.slug(),
        parent_id: this.parentId() || null,
        position: this.position(),
        is_active: this.isActive(),
      },
      this.editing()?.id,
    );
    this.showForm.set(false);
    await this.load();
  }

  async remove(c: Category): Promise<void> {
    if (!confirm(`Excluir categoria "${c.name}"?`)) return;
    await this.admin.deleteCategory(c.id);
    await this.load();
  }
}
