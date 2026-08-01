import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Estratégia de renderização por rota (prerender estático / SSG).
 * Só as páginas públicas e sem parâmetros são pré-renderizadas em HTML no build
 * (ganho de SEO/LCP). Todo o resto continua como SPA (RenderMode.Client) —
 * carrinho, checkout, conta, admin, PDP/categoria (com dados dinâmicos).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender }, // home
  { path: 'produtos', renderMode: RenderMode.Prerender }, // catálogo
  { path: '**', renderMode: RenderMode.Client },
];
