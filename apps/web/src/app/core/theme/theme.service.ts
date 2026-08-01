import { effect, Injectable, signal } from '@angular/core';
import { isBrowser } from '../platform/is-browser';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'legacystore-theme';

/** Alterna e persiste o tema claro/escuro (classe .dark no <html>). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly browser = isBrowser();
  private readonly _theme = signal<Theme>(this.initial());
  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const theme = this._theme();
      if (!this.browser) return;
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem(STORAGE_KEY, theme);
    });
  }

  toggle(): void {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  set(theme: Theme): void {
    this._theme.set(theme);
  }

  private initial(): Theme {
    // No servidor (prerender) assume 'light'; o script inline no index.html
    // aplica o tema real antes do primeiro paint no cliente.
    if (!this.browser) return 'light';
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
