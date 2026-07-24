import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WishlistService } from './wishlist.service';
import { SupabaseService } from '../supabase/supabase.service';
import { makeProduct, mockSupabase } from '../../../testing/mocks';

function create(rows: unknown[] = []): WishlistService {
  TestBed.configureTestingModule({
    providers: [WishlistService, { provide: SupabaseService, useValue: mockSupabase({ rows }) }],
  });
  return TestBed.inject(WishlistService);
}

describe('WishlistService', () => {
  beforeEach(() => localStorage.clear());

  it('começa vazia', () => {
    const w = create();
    expect(w.count()).toBe(0);
    expect(w.has('x')).toBe(false);
  });

  it('toggle adiciona e remove', () => {
    const w = create();
    w.toggle('p1');
    expect(w.has('p1')).toBe(true);
    expect(w.count()).toBe(1);
    w.toggle('p1');
    expect(w.has('p1')).toBe(false);
    expect(w.count()).toBe(0);
  });

  it('remove tira um item específico', () => {
    const w = create();
    w.toggle('p1');
    w.toggle('p2');
    w.remove('p1');
    expect(w.has('p1')).toBe(false);
    expect(w.has('p2')).toBe(true);
  });

  it('persiste no localStorage', () => {
    const w = create();
    w.toggle('p1');
    TestBed.inject(ApplicationRef).tick(); // flush do effect de persistência
    expect(localStorage.getItem('legacystore-wishlist')).toContain('p1');
  });

  it('hidrata do localStorage existente', () => {
    localStorage.setItem('legacystore-wishlist', JSON.stringify(['a', 'b']));
    const w = create();
    expect(w.count()).toBe(2);
    expect(w.has('a')).toBe(true);
  });

  it('list() preserva a ordem dos ids e ignora inativos ausentes', async () => {
    localStorage.setItem('legacystore-wishlist', JSON.stringify(['a', 'b']));
    const w = create([makeProduct({ id: 'b' }), makeProduct({ id: 'a' })]);
    const list = await w.list();
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('list() vazio quando não há ids', async () => {
    const w = create();
    expect(await w.list()).toEqual([]);
  });
});
