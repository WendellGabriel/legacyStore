import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import type { Product } from '@legacystore/shared';
import { AdminService } from '../admin.service';
import { BrlPipe } from '../../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-admin-products',
  imports: [RouterLink, FormsModule, MatIconModule, BrlPipe],
  templateUrl: './products.html',
})
export class Products {
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly duplicatingId = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.products.set(await this.admin.listProducts(this.search() || undefined));
    this.loading.set(false);
  }

  async remove(p: Product): Promise<void> {
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    await this.admin.deleteProduct(p.id);
    await this.load();
  }

  async duplicate(p: Product): Promise<void> {
    if (this.duplicatingId()) return;
    this.duplicatingId.set(p.id);
    const { id, error } = await this.admin.duplicateProduct(p.id);
    this.duplicatingId.set(null);
    if (error || !id) {
      alert(error ?? 'Não foi possível duplicar o produto.');
      return;
    }
    // abre o rascunho recém-criado para o admin ajustar e publicar
    void this.router.navigate(['/admin/produtos', id]);
  }

  protected image(p: Product): string | null {
    return [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.url ?? null;
  }

  protected lowStock(p: Product): boolean {
    return p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold;
  }
}
