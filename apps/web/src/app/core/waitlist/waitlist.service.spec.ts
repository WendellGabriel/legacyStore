import { TestBed } from '@angular/core/testing';
import { WaitlistService } from './waitlist.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';
import { mockSupabase, type SupabaseMockConfig } from '../../../testing/mocks';

const authStub = {
  user: () => ({ id: 'u1', email: 'cliente@teste.com' }),
} as unknown as AuthService;

function create(config: SupabaseMockConfig = {}): WaitlistService {
  TestBed.configureTestingModule({
    providers: [
      WaitlistService,
      { provide: SupabaseService, useValue: mockSupabase(config) },
      { provide: AuthService, useValue: authStub },
    ],
  });
  return TestBed.inject(WaitlistService);
}

describe('WaitlistService', () => {
  it('sugere o e-mail do usuário logado', () => {
    expect(create().suggestedEmail()).toBe('cliente@teste.com');
  });

  it('join com sucesso retorna sem erro', async () => {
    const { error } = await create().join('prod1', { email: 'a@b.com' });
    expect(error).toBeNull();
  });

  it('trata duplicidade como sucesso (já cadastrado)', async () => {
    const svc = create({ error: { message: 'duplicate key value violates unique constraint' } });
    const { error } = await svc.join('prod1', { email: 'a@b.com' });
    expect(error).toBeNull();
  });

  it('repassa outros erros', async () => {
    const svc = create({ error: { message: 'coluna inexistente' } });
    const { error } = await svc.join('prod1', { email: 'a@b.com' });
    expect(error).toBe('coluna inexistente');
  });
});
