import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { Banner } from '@legacystore/shared';
import { Carousel } from './carousel';

const banners = [{}, {}, {}] as Banner[]; // 3 slides

function create() {
  const navigateByUrl = vi.fn();
  TestBed.configureTestingModule({
    imports: [Carousel],
    providers: [{ provide: Router, useValue: { navigateByUrl } }],
  });
  const fixture = TestBed.createComponent(Carousel);
  fixture.componentRef.setInput('banners', banners);
  fixture.detectChanges();
  const cmp = fixture.componentInstance;
  const current = () => (cmp as unknown as { current: () => number }).current();
  return { fixture, cmp, current, navigateByUrl };
}

describe('Carousel', () => {
  it('next avança circularmente', () => {
    const { cmp, current, fixture } = create();
    expect(current()).toBe(0);
    cmp.next();
    expect(current()).toBe(1);
    cmp.next();
    cmp.next();
    expect(current()).toBe(0); // 2 → 0 (wrap)
    fixture.destroy();
  });

  it('prev retrocede circularmente', () => {
    const { cmp, current, fixture } = create();
    cmp.prev();
    expect(current()).toBe(2); // 0 → 2 (wrap)
    fixture.destroy();
  });

  it('go define o índice', () => {
    const { cmp, current, fixture } = create();
    cmp.go(1);
    expect(current()).toBe(1);
    fixture.destroy();
  });

  it('navigate para rota interna usa o router', () => {
    const { cmp, navigateByUrl, fixture } = create();
    cmp.navigate('/promocoes');
    expect(navigateByUrl).toHaveBeenCalledWith('/promocoes');
    fixture.destroy();
  });

  it('navigate para URL externa abre nova aba', () => {
    const openSpy = vi.fn();
    globalThis.open = openSpy as unknown as typeof window.open;
    const { cmp, navigateByUrl, fixture } = create();
    cmp.navigate('https://exemplo.com');
    expect(openSpy).toHaveBeenCalledWith('https://exemplo.com', '_blank', 'noopener');
    expect(navigateByUrl).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('navigate ignora url nula', () => {
    const openSpy = vi.fn();
    globalThis.open = openSpy as unknown as typeof window.open;
    const { cmp, navigateByUrl, fixture } = create();
    cmp.navigate(null);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
