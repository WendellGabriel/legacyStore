import { Component, computed, inject } from '@angular/core';
import { SettingsService } from '../../core/settings/settings.service';

@Component({
  selector: 'app-whatsapp-button',
  template: `
    @if (link()) {
      <a
        [href]="link()"
        target="_blank"
        rel="noopener"
        aria-label="Falar no WhatsApp"
        class="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] shadow-lg transition hover:scale-110"
      >
        <svg viewBox="0 0 24 24" class="h-7 w-7 fill-white">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.25.7-1.44 1.33-1.99 1.41-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.9-4.27-5.05-4.47-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.59-.37.79-.37.2 0 .39.002.56.01.18.008.42-.068.66.5.25.58.83 2.01.9 2.16.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.66-.15.27.1 1.7.8 1.99.95.3.15.5.22.56.35.07.13.07.72-.18 1.42Z"/>
        </svg>
      </a>
    }
  `,
})
export class WhatsappButton {
  private readonly settings = inject(SettingsService);

  protected readonly link = computed(() => {
    const number = this.settings.string('whatsapp').replace(/\D/g, '');
    if (!number) return null;
    const msg = encodeURIComponent('Olá! Tenho uma dúvida sobre a loja.');
    return `https://wa.me/${number}?text=${msg}`;
  });
}
