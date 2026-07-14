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

  // Catálogo (lazy loaded)
  {
    path: 'produtos',
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
    title: 'Produtos — legacyStore',
  },
  {
    path: 'busca',
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
    title: 'Busca — legacyStore',
  },
  {
    path: 'c/:slug',
    loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
    title: 'Categoria — legacyStore',
  },
  {
    path: 'p/:slug',
    loadComponent: () => import('./features/product/product').then((m) => m.Product),
    title: 'Produto — legacyStore',
  },

  // Carrinho e lista de desejos (lazy loaded)
  {
    path: 'carrinho',
    loadComponent: () => import('./features/cart/cart').then((m) => m.Cart),
    title: 'Carrinho — legacyStore',
  },
  {
    path: 'lista-de-desejos',
    loadComponent: () => import('./features/wishlist/wishlist').then((m) => m.Wishlist),
    title: 'Lista de desejos — legacyStore',
  },

  // As rotas de checkout, conta e admin entram nas próximas fases.
  { path: '**', redirectTo: '' },
];
