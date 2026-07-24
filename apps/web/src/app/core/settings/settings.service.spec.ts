import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { SupabaseService } from '../supabase/supabase.service';
import { mockSupabase } from '../../../testing/mocks';

const rows = [
  { key: 'whatsapp', value: '5581999999999' },
  { key: 'auto_preorder_on_zero', value: true },
  { key: 'free_shipping_threshold', value: 299.9 },
];

function create(): SettingsService {
  TestBed.configureTestingModule({
    providers: [SettingsService, { provide: SupabaseService, useValue: mockSupabase({ rows }) }],
  });
  return TestBed.inject(SettingsService);
}

describe('SettingsService', () => {
  it('load popula o mapa de settings', async () => {
    const s = create();
    await s.load();
    expect(s.get<boolean>('auto_preorder_on_zero')).toBe(true);
    expect(s.string('whatsapp')).toBe('5581999999999');
  });

  it('string cai no fallback quando o valor não é string', async () => {
    const s = create();
    await s.load();
    // free_shipping_threshold é number → string() retorna o fallback
    expect(s.string('free_shipping_threshold', 'n/a')).toBe('n/a');
    expect(s.string('inexistente', 'padrão')).toBe('padrão');
  });

  it('get retorna o fallback para chave ausente', async () => {
    const s = create();
    await s.load();
    expect(s.get('inexistente', 42)).toBe(42);
  });

  it('load é idempotente (não recarrega)', async () => {
    const s = create();
    await s.load();
    await s.load(); // segunda chamada não deve quebrar nem alterar
    expect(s.string('whatsapp')).toBe('5581999999999');
  });
});
