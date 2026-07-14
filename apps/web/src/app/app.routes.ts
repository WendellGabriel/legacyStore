import { Routes } from '@angular/router';
import { Home } from './features/home/home';

export const routes: Routes = [
  { path: '', component: Home, title: 'legacyStore — Trading Card Games' },

  // As rotas abaixo entram nas próximas fases (catálogo, carrinho, conta, admin).
  // Placeholder: qualquer rota desconhecida volta para a home por enquanto.
  { path: '**', redirectTo: '' },
];
