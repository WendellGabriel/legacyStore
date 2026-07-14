import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Product } from '@legacystore/shared';
import { SupabaseService } from '../supabase/supabase.service';

const STORAGE_KEY = 'legacystore-cart';
const COUPON_KEY = 'legacystore-coupon';

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

  /** Resolve quando o carrinho terminou de hidratar do Supabase. */
  private resolveReady!: () => void;
  readonly whenReady = new Promise<void>((resolve) => (this.resolveReady = resolve));

  // Cupom (persistido; revalidado autoritativamente pela RPC no pedido)
  readonly couponCode = signal<string | null>(localStorage.getItem(COUPON_KEY));
  readonly couponDiscount = signal(0);
  readonly total = computed(() => Math.max(0, this.subtotal() - this.couponDiscount()));

  constructor() {
    // persiste sempre que o conteúdo muda
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stored())));
    effect(() => {
      const code = this.couponCode();
      if (code) localStorage.setItem(COUPON_KEY, code);
      else localStorage.removeItem(COUPON_KEY);
    });
    void this.hydrate();
  }

  /** Valida um cupom via RPC e aplica o desconto. Retorna erro se inválido. */
  async applyCoupon(code: string): Promise<string | null> {
    const trimmed = code.trim();
    if (!trimmed) return 'Informe um cupom';
    const { data, error } = await this.supabase.client.rpc('validate_coupon', {
      p_code: trimmed,
      p_order_total: this.subtotal(),
    });
    const result = data as { valid: boolean; reason?: string; discount?: number } | null;
    if (error || !result?.valid) {
      this.clearCoupon();
      return result?.reason ?? 'Cupom inválido';
    }
    this.couponCode.set(trimmed);
    this.couponDiscount.set(result.discount ?? 0);
    return null;
  }

  /** Revalida o cupom salvo (ex.: ao abrir o checkout). */
  async revalidateCoupon(): Promise<void> {
    const code = this.couponCode();
    if (code) await this.applyCoupon(code);
  }

  clearCoupon(): void {
    this.couponCode.set(null);
    this.couponDiscount.set(0);
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
    this.resolveReady();
    void this.revalidateCoupon();
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
    this.clearCoupon();
    this.rebuild();
  }

  /** Itens no formato aceito pela RPC create_order. */
  toOrderItems(): { product_id: string; quantity: number }[] {
    return this.stored().map((i) => ({ product_id: i.productId, quantity: i.quantity }));
  }
}
