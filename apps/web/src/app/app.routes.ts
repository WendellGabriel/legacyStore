import { Routes } from '@angular/router';
import { Home } from './features/home/home';

export const routes: Routes = [
  { path: '', component: Home, title: 'legacyStore — Trading Card Games' },

  // Autenticação (lazy loaded)
  {
    path: 'entrar',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    title: 'Entrar — legacyStore',
  },
  {
    path: 'cadastro',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
    title: 'Criar conta — legacyStore',
  },
  {
    path: 'recuperar-senha',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
    title: 'Recuperar senha — legacyStore',
  },
  {
    path: 'nova-senha',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
    title: 'Nova senha — legacyStore',
  },

  // As rotas de catálogo, carrinho, conta e admin entram nas próximas fases.
  { path: '**', redirectTo: '' },
];
