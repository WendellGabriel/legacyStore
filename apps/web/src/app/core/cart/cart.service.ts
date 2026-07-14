import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Product } from '@legacystore/shared';
import { SupabaseService } from '../supabase/supabase.service';

const STORAGE_KEY = 'legacystore-cart';

interface StoredItem {
  productId: string;
  quantity: number;
}

export interface CartLine {
  product: Product;
  quantity: number;
}

/**
 * Carrinho client-side (localStorage) — funciona para visitante e logado.
 * Guarda apenas { productId, quantity }; os dados do produto são hidratados
 * do Supabase (fonte de verdade de preço/estoque). No checkout, os itens
 * vão para a RPC create_order.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly supabase = inject(SupabaseService);

  private readonly stored = signal<StoredItem[]>(this.read());
  private readonly cache = new Map<string, Product>();

  readonly lines = signal<CartLine[]>([]);
  readonly count = computed(() => this.lines().reduce((n, l) => n + l.quantity, 0));
  readonly subtotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.product.price * l.quantity, 0),
  );
  readonly isEmpty = computed(() => this.lines().length === 0);

  constructor() {
    // persiste sempre que o conteúdo muda
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stored())));
    void this.hydrate();
  }

  private read(): StoredItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredItem[]) : [];
    } catch {
      return [];
    }
  }

  /** Carrega os dados dos produtos do carrinho e monta as linhas. */
  private async hydrate(): Promise<void> {
    const items = this.stored();
    const missing = items.map((i) => i.productId).filter((id) => !this.cache.has(id));

    if (missing.length) {
      const { data } = await this.supabase.client
        .from('products')
        .select('*, images:product_images(*)')
        .in('id', missing);
      for (const p of (data as Product[]) ?? []) this.cache.set(p.id, p);
    }

    this.rebuild();
  }

  private rebuild(): void {
    const lines: CartLine[] = [];
    for (const item of this.stored()) {
      const product = this.cache.get(item.productId);
      if (product) lines.push({ product, quantity: item.quantity });
    }
    this.lines.set(lines);
  }

  /** Adiciona um produto (respeitando o estoque). */
  add(product: Product, quantity = 1): void {
    this.cache.set(product.id, product);
    this.stored.update((items) => {
      const existing = items.find((i) => i.productId === product.id);
      const max = product.stock_quantity;
      if (existing) {
        return items.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: Math.min(i.quantity + quantity, max) }
            : i,
        );
      }
      return [...items, { productId: product.id, quantity: Math.min(quantity, max) }];
    });
    this.rebuild();
  }

  setQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) return this.remove(productId);
    const max = this.cache.get(productId)?.stock_quantity ?? quantity;
    this.stored.update((items) =>
      items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(quantity, max) } : i)),
    );
    this.rebuild();
  }

  remove(productId: string): void {
    this.stored.update((items) => items.filter((i) => i.productId !== productId));
    this.rebuild();
  }

  clear(): void {
    this.stored.set([]);
    this.rebuild();
  }

  /** Itens no formato aceito pela RPC create_order. */
  toOrderItems(): { product_id: string; quantity: number }[] {
    return this.stored().map((i) => ({ product_id: i.productId, quantity: i.quantity }));
  }
}
