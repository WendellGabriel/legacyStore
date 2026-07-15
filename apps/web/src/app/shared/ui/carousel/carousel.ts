import { Component, DestroyRef, inject, input, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { Banner } from '@legacystore/shared';

@Component({
  selector: 'app-carousel',
  imports: [MatIconModule],
  templateUrl: './carousel.html',
})
export class Carousel {
  readonly banners = input.required<Banner[]>();
  readonly interval = input(5000);

  protected readonly current = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // (re)inicia o auto-play quando os banners mudam
    effect(() => {
      const count = this.banners().length;
      this.stop();
      if (count > 1) this.start();
    });
    destroyRef.onDestroy(() => this.stop());
  }

  private start(): void {
    this.timer = setInterval(() => this.next(), this.interval());
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  next(): void {
    const n = this.banners().length;
    if (n) this.current.set((this.current() + 1) % n);
  }

  prev(): void {
    const n = this.banners().length;
    if (n) this.current.set((this.current() - 1 + n) % n);
  }

  go(index: number): void {
    this.current.set(index);
    // reinicia o timer ao interagir
    this.stop();
    if (this.banners().length > 1) this.start();
  }

  private readonly router = inject(Router);

  /** Navega ao clicar no slide (rota interna ou URL externa). */
  navigate(url: string | null): void {
    if (!url) return;
    if (url.startsWith('/')) void this.router.navigateByUrl(url);
    else window.open(url, '_blank', 'noopener');
  }
}
