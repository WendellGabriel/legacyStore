import { TestBed } from '@angular/core/testing';
import { RecentlyViewedService } from './recently-viewed.service';
import { SupabaseService } from '../supabase/supabase.service';
import { makeProduct, mockSupabase } from '../../../testing/mocks';

const KEY = 'legacystore-recently-viewed';

function create(rows: unknown[] = []): RecentlyViewedService {
  TestBed.configureTestingModule({
    providers: [
      RecentlyViewedService,
      { provide: SupabaseService, useValue: mockSupabase({ rows }) },
    ],
  });
  return TestBed.inject(RecentlyViewedService);
}

describe('RecentlyViewedService', () => {
  beforeEach(() => localStorage.clear());

  it('track coloca o mais recente no topo', () => {
    const s = create();
    s.track('a');
    s.track('b');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['b', 'a']);
  });

  it('track deduplica movendo o item para o topo', () => {
    const s = create();
    s.track('a');
    s.track('b');
    s.track('a');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['a', 'b']);
  });

  it('track limita a 12 itens', () => {
    const s = create();
    for (let i = 0; i < 20; i++) s.track('p' + i);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(12);
  });

  it('list exclui o produto atual e preserva a ordem de visualização', async () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b', 'c']));
    const s = create([makeProduct({ id: 'c' }), makeProduct({ id: 'a' }), makeProduct({ id: 'b' })]);
    const list = await s.list('b');
    expect(list.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('list vazio quando não há histórico', async () => {
    const s = create();
    expect(await s.list()).toEqual([]);
  });
});
