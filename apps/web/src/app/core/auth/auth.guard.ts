import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';

/** Exige usuário autenticado; senão redireciona para /entrar. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  if (data.session) return true;

  return router.createUrlTree(['/entrar'], {
    queryParams: { redirect: state.url },
  });
};

/** Exige usuário com role = admin; senão manda para a home. */
export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  if (!data.session) return router.createUrlTree(['/entrar']);

  // confere a role direto no banco (RLS garante que só o próprio perfil retorna)
  const { data: profile } = await supabase.client
    .from('profiles')
    .select('role')
    .eq('id', data.session.user.id)
    .single();

  if (profile?.role === 'admin') return true;
  return router.createUrlTree(['/']);
};
