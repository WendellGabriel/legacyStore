import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { Category, ProductImage } from '@legacystore/shared';
import { PRODUCT_TYPES, productFormSchema } from '@legacystore/shared';
import { AdminService } from '../admin.service';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Component({
  selector: 'app-admin-product-form',
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './product-form.html',
})
export class ProductForm {
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly productTypes = PRODUCT_TYPES;
  protected readonly categories = signal<Category[]>([]);
  protected readonly images = signal<ProductImage[]>([]);
  protected readonly pendingFiles = signal<File[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly productId = signal<string | null>(null);
  protected readonly isNew = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    sku: ['', Validators.required],
    description: [''],
    category_id: [''],
    product_type: ['single' as (typeof PRODUCT_TYPES)[number], Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    compare_at_price: [null as number | null],
    stock_quantity: [0, [Validators.required, Validators.min(0)]],
    low_stock_threshold: [5],
    weight_grams: [null as number | null],
    is_featured: [false],
    is_active: [true],
    allow_preorder: [false],
    seo_title: [''],
    seo_description: [''],
  });

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    this.categories.set(await this.admin.listCategories());
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'novo') {
      this.productId.set(id);
      this.isNew.set(false);
      const p = await this.admin.getProduct(id);
      if (p) {
        this.form.patchValue({
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          description: p.description ?? '',
          category_id: p.category_id ?? '',
          product_type: p.product_type,
          price: p.price,
          compare_at_price: p.compare_at_price,
          stock_quantity: p.stock_quantity,
          low_stock_threshold: p.low_stock_threshold,
          weight_grams: p.weight_grams,
          is_featured: p.is_featured,
          is_active: p.is_active,
          allow_preorder: p.allow_preorder,
          seo_title: p.seo_title ?? '',
          seo_description: p.seo_description ?? '',
        });
        this.images.set([...(p.images ?? [])].sort((a, b) => a.position - b.position));
      }
    }
  }

  onNameBlur(): void {
    if (this.isNew() && !this.form.controls.slug.value) {
      this.form.controls.slug.setValue(slugify(this.form.controls.name.value));
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.pendingFiles.update((f) => [...f, ...Array.from(input.files!)]);
  }

  removePending(index: number): void {
    this.pendingFiles.update((f) => f.filter((_, i) => i !== index));
  }

  async removeImage(img: ProductImage): Promise<void> {
    await this.admin.removeProductImage(img.id);
    this.images.update((list) => list.filter((i) => i.id !== img.id));
  }

  async save(): Promise<void> {
    this.error.set(null);
    const raw = this.form.getRawValue();
    const parsed = productFormSchema.safeParse({
      ...raw,
      category_id: raw.category_id || null,
      compare_at_price: raw.compare_at_price || null,
      weight_grams: raw.weight_grams || null,
    });
    if (!parsed.success) {
      this.error.set(parsed.error.issues[0]?.message ?? 'Verifique os campos.');
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    let id = this.productId();

    if (this.isNew()) {
      const res = await this.admin.createProduct(parsed.data);
      if (res.error || !res.id) {
        this.saving.set(false);
        this.error.set(res.error ?? 'Erro ao criar produto.');
        return;
      }
      id = res.id;
    } else if (id) {
      const res = await this.admin.updateProduct(id, parsed.data);
      if (res.error) {
        this.saving.set(false);
        this.error.set(res.error);
        return;
      }
    }

    // faz upload das fotos pendentes
    if (id && this.pendingFiles().length) {
      let pos = this.images().length;
      for (const file of this.pendingFiles()) {
        const url = await this.admin.uploadImage(id, file);
        if (url) await this.admin.addProductImage(id, url, pos++);
      }
    }

    this.saving.set(false);
    void this.router.navigateByUrl('/admin/produtos');
  }
}
