import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { authGuard, adminGuard } from './core/auth/auth.guard';

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

  // Checkout (requer login)
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout),
    title: 'Finalizar compra — legacyStore',
  },
  {
    path: 'pedido/:orderNumber',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/confirmation').then((m) => m.Confirmation),
    title: 'Pedido — legacyStore',
  },

  // Conta do cliente (requer login) — layout com sub-rotas
  {
    path: 'conta',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/account').then((m) => m.Account),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/account/profile').then((m) => m.Profile),
        title: 'Meu perfil — legacyStore',
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./features/account/orders').then((m) => m.Orders),
        title: 'Meus pedidos — legacyStore',
      },
      {
        path: 'pedidos/:orderNumber',
        loadComponent: () =>
          import('./features/account/order-detail').then((m) => m.OrderDetail),
        title: 'Pedido — legacyStore',
      },
      {
        path: 'enderecos',
        loadComponent: () => import('./features/account/addresses').then((m) => m.Addresses),
        title: 'Endereços — legacyStore',
      },
    ],
  },

  // Painel administrativo (requer role admin)
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin').then((m) => m.Admin),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard — Admin',
      },
      {
        path: 'produtos',
        loadComponent: () => import('./features/admin/products/products').then((m) => m.Products),
        title: 'Produtos — Admin',
      },
      {
        path: 'produtos/:id',
        loadComponent: () =>
          import('./features/admin/products/product-form').then((m) => m.ProductForm),
        title: 'Produto — Admin',
      },
      {
        path: 'pedidos',
        loadComponent: () =>
          import('./features/admin/orders/admin-orders').then((m) => m.AdminOrders),
        title: 'Pedidos — Admin',
      },
      {
        path: 'pedidos/:orderNumber',
        loadComponent: () =>
          import('./features/admin/orders/admin-order-detail').then((m) => m.AdminOrderDetail),
        title: 'Pedido — Admin',
      },
      {
        path: 'estoque',
        loadComponent: () => import('./features/admin/stock/stock').then((m) => m.Stock),
        title: 'Estoque — Admin',
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./features/admin/categories/categories').then((m) => m.Categories),
        title: 'Categorias — Admin',
      },
      {
        path: 'banners',
        loadComponent: () => import('./features/admin/banners/banners').then((m) => m.Banners),
        title: 'Banners — Admin',
      },
      {
        path: 'cupons',
        loadComponent: () => import('./features/admin/coupons/coupons').then((m) => m.Coupons),
        title: 'Cupons — Admin',
      },
      {
        path: 'frete',
        loadComponent: () =>
          import('./features/admin/shipping/shipping-zones').then((m) => m.ShippingZones),
        title: 'Zonas de frete — Admin',
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/admin/customers/customers').then((m) => m.Customers),
        title: 'Clientes — Admin',
      },
      { path: '**', redirectTo: '' },
    ],
  },

  { path: '**', redirectTo: '' },
];
