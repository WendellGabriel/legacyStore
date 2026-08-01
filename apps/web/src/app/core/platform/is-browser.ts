import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * `true` quando o código roda no navegador; `false` em SSR/prerender (Node).
 * Deve ser chamado em contexto de injeção (inicializador de campo ou construtor
 * de um serviço/componente). Guarda acessos a `window`/`document`/`localStorage`,
 * que não existem no servidor.
 */
export function isBrowser(): boolean {
  return isPlatformBrowser(inject(PLATFORM_ID));
}
