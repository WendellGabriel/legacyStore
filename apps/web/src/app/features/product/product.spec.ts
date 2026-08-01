import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { Product as ProductModel } from '@legacystore/shared';
import { Product } from './product';
import { CatalogService } from '../catalog/catalog.service';
import { RecentlyViewedService } from '../../core/recently-viewed/recently-viewed.service';
import { CartService } from '../../core/cart/cart.service';
import { WishlistService } from '../../core/wishlist/wishlist.service';
import { WaitlistService } from '../../core/waitlist/waitlist.service';
import { SettingsService } from '../../core/settings/settings.service';
import { SeoService } from '../../core/seo/seo.service';
import { makeProduct } from '../../../testing/mocks';

const add = vi.fn();
const toggle = vi.fn();
const track = vi.fn();
const join = vi.fn();
const seoUpdate = vi.fn();
const getProductBySlug = vi.fn();
const getRelatedProducts = vi.fn();

interface BuildOpts {
  product?: ProductModel | null;
  autoPreorder?: boolean;
}

interface ProductShape {
  product: () => ProductModel | null;
  loading: () => boolean;
  activeImage: () => string | null;
  quantity: () => number;
  related: () => ProductModel[];
  discount: () => number | null;
  outOfStock: () => boolean;
  lowStock: () => boolean;
  preorder: () => boolean;
  images: () => { url: string; position: number }[];
  interestForm: { setValue: (v: { email: string; whatsapp: string }) => void };
  interestDone: () => boolean;
  interestError: () => string | null;
  changeQty: (d: number) => void;
  addToCart: () => void;
  toggleWishlist: () => void;
  submitInterest: () => Promise<void>;
}

function build(opts: BuildOpts = {}) {
  [add, toggle, track, join, seoUpdate, getProductBySlug, getRelatedProducts].forEach((m) => m.mockReset());
  getProductBySlug.mockResolvedValue(opts.product ?? null);
  getRelatedProducts.mockResolvedValue([]);
  join.mockResolvedValue({ error: null });

  TestBed.configureTestingModule({
    imports: [Product],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug: 'box-x' })) } },
      { provide: CatalogService, useValue: { getProductBySlug, getRelatedProducts } },
      { provide: RecentlyViewedService, useValue: { track, list: async () => [] } },
      { provide: CartService, useValue: { add } },
      { provide: WishlistService, useValue: { toggle, has: () => false } },
      { provide: WaitlistService, useValue: { join, suggestedEmail: () => 'x@y.com' } },
      { provide: SettingsService, useValue: { get: () => opts.autoPreorder ?? false } },
      { provide: SeoService, useValue: { update: seoUpdate } },
    ],
  });
  // template vazio → testa só a lógica (sem ProductCard/BrlPipe/DOM)
  TestBed.overrideComponent(Product, { set: { template: '' } });

  const router = TestBed.inject(Router);
  const navUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Product);
  return { cmp: fixture.componentInstance as unknown as ProductShape, navUrlSpy };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Product (PDP)', () => {
  it('carrega o produto, define imagem ativa e atualiza SEO', async () => {
    const p = makeProduct({
      name: 'Box Charizard',
      images: [
        { id: 'i2', product_id: 'p', url: 'b.jpg', alt: null, position: 2 },
        { id: 'i1', product_id: 'p', url: 'a.jpg', alt: null, position: 1 },
      ],
    } as Partial<ProductModel>);
    const { cmp } = build({ product: p });
    await flush();
    expect(cmp.product()?.name).toBe('Box Charizard');
    expect(cmp.activeImage()).toBe('a.jpg'); // menor position primeiro
    expect(cmp.loading()).toBe(false);
    expect(track).toHaveBeenCalledWith(p.id);
    expect(seoUpdate).toHaveBeenCalled();
  });

  it('redireciona para /produtos quando o produto não existe', async () => {
    const { navUrlSpy } = build({ product: null });
    await flush();
    expect(navUrlSpy).toHaveBeenCalledWith('/produtos');
  });

  it('discount calcula o percentual quando há compare_at_price maior', async () => {
    const { cmp } = build({ product: makeProduct({ price: 80, compare_at_price: 100 }) });
    await flush();
    expect(cmp.discount()).toBe(20);
  });

  it('discount é null sem promoção', async () => {
    const { cmp } = build({ product: makeProduct({ price: 100, compare_at_price: null }) });
    await flush();
    expect(cmp.discount()).toBeNull();
  });

  it('outOfStock verdadeiro sem estoque', async () => {
    const { cmp } = build({ product: makeProduct({ stock_quantity: 0 }) });
    await flush();
    expect(cmp.outOfStock()).toBe(true);
  });

  it('lowStock verdadeiro quando estoque baixo (mas > 0)', async () => {
    const { cmp } = build({ product: makeProduct({ stock_quantity: 3, low_stock_threshold: 5 }) });
    await flush();
    expect(cmp.outOfStock()).toBe(false);
    expect(cmp.lowStock()).toBe(true);
  });

  it('changeQty limita entre 1 e o estoque', async () => {
    const { cmp } = build({ product: makeProduct({ stock_quantity: 2 }) });
    await flush();
    cmp.changeQty(-1);
    expect(cmp.quantity()).toBe(1); // não desce abaixo de 1
    cmp.changeQty(5);
    expect(cmp.quantity()).toBe(2); // não passa do estoque
  });

  it('addToCart adiciona com a quantidade escolhida', async () => {
    const p = makeProduct({ stock_quantity: 5 });
    const { cmp } = build({ product: p });
    await flush();
    cmp.changeQty(2);
    cmp.addToCart();
    expect(add).toHaveBeenCalledWith(p, 3);
  });

  it('toggleWishlist alterna pelo id do produto', async () => {
    const p = makeProduct();
    const { cmp } = build({ product: p });
    await flush();
    cmp.toggleWishlist();
    expect(toggle).toHaveBeenCalledWith(p.id);
  });

  it('preorder verdadeiro quando esgotado e permite pré-venda', async () => {
    const { cmp } = build({ product: makeProduct({ stock_quantity: 0, allow_preorder: true }) });
    await flush();
    expect(cmp.preorder()).toBe(true);
  });

  it('submitInterest não envia com formulário inválido', async () => {
    const { cmp } = build({ product: makeProduct({ stock_quantity: 0, allow_preorder: true }) });
    await flush();
    cmp.interestForm.setValue({ email: 'invalido', whatsapp: '' });
    await cmp.submitInterest();
    expect(join).not.toHaveBeenCalled();
  });

  it('submitInterest registra o interesse com e-mail válido', async () => {
    const p = makeProduct({ stock_quantity: 0, allow_preorder: true });
    const { cmp } = build({ product: p });
    await flush();
    cmp.interestForm.setValue({ email: 'ana@x.com', whatsapp: '81999' });
    await cmp.submitInterest();
    expect(join).toHaveBeenCalledWith(p.id, { email: 'ana@x.com', whatsapp: '81999' });
    expect(cmp.interestDone()).toBe(true);
  });
});
