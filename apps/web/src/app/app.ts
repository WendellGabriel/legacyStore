import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './layout/header/header';
import { Footer } from './layout/footer/footer';
import { WhatsappButton } from './layout/whatsapp-button/whatsapp-button';
import { ThemeService } from './core/theme/theme.service';
import { SettingsService } from './core/settings/settings.service';
import { AnalyticsService } from './core/analytics/analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, WhatsappButton],
  templateUrl: './app.html',
})
export class App {
  // Instancia o ThemeService no arranque para aplicar o tema salvo.
  private readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsService);
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);

  // Esconde o header/footer da loja nas rotas do painel admin.
  protected readonly showStoreChrome = signal(true);

  constructor() {
    void this.settings.load().then(() => this.analytics.init(this.settings));

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.showStoreChrome.set(!e.urlAfterRedirects.startsWith('/admin')));
  }
}
