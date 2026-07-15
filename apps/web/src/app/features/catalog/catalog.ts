import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import type { Category, Product, ProductTypeValue } from '@legacystore/shared';
import { CatalogService, CatalogFilters } from './catalog.service';
import { SeoService } from '../../core/seo/seo.service';
import { ProductCard } from '../../shared/ui/product-card/product-card';

type SortOption = NonNullable<CatalogFilters['sort']>;

@Component({
  selector: 'app-catalog',
  imports: [RouterLink, FormsModule, MatIconModule, ProductCard],
  templateUrl: './catalog.html',
})
export class Catalog {
  private readonly service = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly PAGE_SIZE = 12;

  protected readonly loading = signal(true);
  protected readonly products = signal<Product[]>([]);
  protected readonly total = signal(0);
  protected readonly category = signal<Category | null>(null);

  // estado derivado da URL
  private readonly slug = signal<string | undefined>(undefined);
  private readonly searchTerm = signal<string | undefined>(undefined);
  protected readonly sort = signal<SortOption>('newest');
  protected readonly productType = signal<ProductTypeValue | ''>('');
  protected readonly onlyInStock = signal(false);
  protected readonly onSale = signal(false);
  protected readonly page = signal(1);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.PAGE_SIZE)),
  );

  protected readonly heading = computed(() => {
    const search = this.searchTerm();
    if (search) return `Resultados para "${search}"`;
    return this.category()?.name ?? 'Todos os produtos';
  });

  protected readonly productTypes: { value: ProductTypeValue; label: string }[] = [
    { value: 'box', label: 'Boxes' },
    { value: 'single', label: 'Cartas avulsas' },
    { value: 'sealed', label: 'Selados' },
    { value: 'accessory', label: 'Acessórios' },
  ];

  protected readonly sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Mais recentes' },
    { value: 'price_asc', label: 'Menor preço' },
    { value: 'price_desc', label: 'Maior preço' },
    { value: 'name', label: 'Nome (A-Z)' },
  ];

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      this.slug.set(params.get('slug') ?? undefined);
      this.searchTerm.set(query.get('q') ?? undefined);
      this.sort.set((query.get('sort') as SortOption) ?? 'newest');
      this.productType.set((query.get('type') as ProductTypeValue) ?? '');
      this.onlyInStock.set(query.get('stock') === '1');
      this.onSale.set(query.get('sale') === '1');
      this.page.set(Number(query.get('page') ?? '1'));
      void this.load();
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const slug = this.slug();

    this.category.set(slug ? await this.service.getCategoryBySlug(slug) : null);

    const result = await this.service.listProducts({
      categorySlug: slug,
      search: this.searchTerm(),
      productType: this.productType() || undefined,
      onlyInStock: this.onlyInStock(),
      onSale: this.onSale(),
      sort: this.sort(),
      page: this.page(),
      pageSize: this.PAGE_SIZE,
    });

    this.products.set(result.products);
    this.total.set(result.total);
    this.loading.set(false);

    const heading = this.heading();
    this.seo.update({
      title: heading,
      description: `${heading} — ${result.total} produto(s) na legacyStore. Boxes, cartas avulsas e acessórios de TCG.`,
    });
  }

  /** Atualiza a URL (query params) — dispara o reload via subscription. */
  private updateFilters(patch: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
    });
  }

  protected setSort(value: SortOption): void {
    this.updateFilters({ sort: value, page: null });
  }
  protected setType(value: ProductTypeValue | ''): void {
    this.updateFilters({ type: value || null, page: null });
  }
  protected toggleStock(): void {
    this.updateFilters({ stock: this.onlyInStock() ? null : '1', page: null });
  }
  protected toggleSale(): void {
    this.updateFilters({ sale: this.onSale() ? null : '1', page: null });
  }
  protected goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.updateFilters({ page: p === 1 ? null : String(p) });
  }
}
