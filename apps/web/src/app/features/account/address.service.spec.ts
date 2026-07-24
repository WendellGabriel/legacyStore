import { TestBed } from '@angular/core/testing';
import { AddressService } from './address.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { mockSupabase } from '../../../testing/mocks';

const authStub = { user: () => ({ id: 'u1' }) } as unknown as AuthService;

function create(): AddressService {
  TestBed.configureTestingModule({
    providers: [
      AddressService,
      { provide: SupabaseService, useValue: mockSupabase() },
      { provide: AuthService, useValue: authStub },
    ],
  });
  return TestBed.inject(AddressService);
}

/** Stub de fetch que resolve com o JSON informado. */
function stubFetch(json: unknown): void {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve(json) } as Response),
  );
}

describe('AddressService.lookupCep', () => {
  it('mapeia a resposta do ViaCEP', async () => {
    stubFetch({ logradouro: 'Av. Boa Viagem', bairro: 'Boa Viagem', localidade: 'Recife', uf: 'PE' });
    const s = create();
    const r = await s.lookupCep('51020-000');
    expect(r).toEqual({
      street: 'Av. Boa Viagem',
      neighborhood: 'Boa Viagem',
      city: 'Recife',
      state: 'PE',
    });
    // o CEP é normalizado (sem hífen) na URL
    expect(fetch).toHaveBeenCalledWith('https://viacep.com.br/ws/51020000/json/');
  });

  it('retorna null quando o ViaCEP marca erro', async () => {
    stubFetch({ erro: true });
    const s = create();
    expect(await s.lookupCep('00000000')).toBeNull();
  });

  it('não chama a rede para CEP com tamanho inválido', async () => {
    stubFetch({});
    const s = create();
    expect(await s.lookupCep('123')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retorna null quando o fetch falha', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const s = create();
    expect(await s.lookupCep('51020000')).toBeNull();
  });
});
