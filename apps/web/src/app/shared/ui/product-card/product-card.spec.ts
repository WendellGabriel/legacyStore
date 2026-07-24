import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Product } from '@legacystore/shared';
import { ProductCard } from './product-card';
import { CartService } from '../../../core/cart/cart.service';
import { WishlistService } from '../../../core/wishlist/wishlist.service';
import { SettingsService } from '../../../core/settings/settings.service';
import { makeProduct } from '../../../../testing/mocks';

const addSpy = vi.fn();
const toggleSpy = vi.fn();

function render(product: Product, autoPreorder = false) {
  addSpy.mockClear();
  toggleSpy.mockClear();
  TestBed.configureTestingModule({
    imports: [ProductCard],
    providers: [
      provideRouter([]),
      { provide: CartService, useValue: { add: addSpy } },
      { provide: WishlistService, useValue: { has: () => false, toggle: toggleSpy } },
      { provide: SettingsService, useValue: { get: () => autoPreorder } },
    ],
  });
  const fixture = TestBed.createComponent(ProductCard);
  fixture.componentRef.setInput('product', product);
  fixture.detectChanges();
  return fixture;
}

function text(fixture: ReturnType<typeof render>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('ProductCard', () => {
  it('mostra nome e preço formatado', () => {
    const f = render(makeProduct({ name: 'Box Charizard', price: 199.9 }));
    const t = text(f);
    expect(t).toContain('Box Charizard');
    expect(t).toContain('R$');
    expect(t).toContain('199,90');
  });

  it('mostra o badge de desconto quando há compare_at_price maior', () => {
    const f = render(makeProduct({ price: 80, compare_at_price: 100 }));
    expect(text(f)).toContain('-20%');
  });

  it('mostra "Esgotado" quando sem estoque e sem pré-venda', () => {
    const f = render(makeProduct({ stock_quantity: 0, allow_preorder: false }), false);
    expect(text(f)).toContain('Esgotado');
    expect(text(f)).not.toContain('Pré-venda');
  });

  it('mostra "Pré-venda" quando esgotado e o produto permite', () => {
    const f = render(makeProduct({ stock_quantity: 0, allow_preorder: true }), false);
    expect(text(f)).toContain('Pré-venda');
    expect(text(f)).not.toContain('Esgotado');
  });

  it('mostra "Pré-venda" quando esgotado e o global automático está ligado', () => {
    const f = render(makeProduct({ stock_quantity: 0, allow_preorder: false }), true);
    expect(text(f)).toContain('Pré-venda');
  });

  it('esconde o botão de adicionar quando esgotado', () => {
    const f = render(makeProduct({ stock_quantity: 0 }));
    const btn = (f.nativeElement as HTMLElement).querySelector('button[aria-label="Adicionar ao carrinho"]');
    expect(btn).toBeNull();
  });

  it('adiciona ao carrinho ao clicar no botão', () => {
    const product = makeProduct({ stock_quantity: 5 });
    const f = render(product);
    const btn = (f.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Adicionar ao carrinho"]',
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(addSpy).toHaveBeenCalledWith(product, 1);
  });
});
