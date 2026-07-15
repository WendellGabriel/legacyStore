import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
}

const SITE_NAME = 'legacyStore';
const DEFAULT_DESC =
  'Loja de Trading Card Games: boxes, cartas avulsas e acessórios. Pokémon, Magic, Yu-Gi-Oh! e mais.';

/** Atualiza title e meta tags (SEO + Open Graph) por página. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  update(data: SeoData): void {
    const fullTitle = data.title.includes(SITE_NAME) ? data.title : `${data.title} — ${SITE_NAME}`;
    const description = data.description || DEFAULT_DESC;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: data.type ?? 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    if (data.image) this.meta.updateTag({ property: 'og:image', content: data.image });
    if (data.url) this.meta.updateTag({ property: 'og:url', content: data.url });

    // Twitter
    this.meta.updateTag({ name: 'twitter:card', content: data.image ? 'summary_large_image' : 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    if (data.image) this.meta.updateTag({ name: 'twitter:image', content: data.image });
  }

  reset(): void {
    this.update({ title: SITE_NAME, description: DEFAULT_DESC });
  }
}
