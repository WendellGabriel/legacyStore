import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { SettingsService } from '../settings/settings.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
  }
}

/**
 * Carrega Google Analytics 4 e Meta Pixel a partir das configurações da loja
 * (store_settings) e envia page_view a cada mudança de rota.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private gaId = '';
  private pixelId = '';
  private started = false;

  init(settings: SettingsService): void {
    if (this.started) return;
    this.started = true;

    this.gaId = settings.string('ga_measurement_id').trim();
    this.pixelId = settings.string('meta_pixel_id').trim();

    if (this.gaId) this.loadGA();
    if (this.pixelId) this.loadPixel();

    if (this.gaId || this.pixelId) {
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => this.pageView(e.urlAfterRedirects));
    }
  }

  private loadGA(): void {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', this.gaId);
  }

  private loadPixel(): void {
    /* Meta Pixel base code */
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode!.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq!('init', this.pixelId);
    window.fbq!('track', 'PageView');
  }

  private pageView(url: string): void {
    if (this.gaId && window.gtag) window.gtag('event', 'page_view', { page_path: url });
    if (this.pixelId && window.fbq) window.fbq('track', 'PageView');
  }
}
