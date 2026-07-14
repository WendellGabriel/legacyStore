import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

interface NavItem {
  label: string;
  slug: string;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, MatMenuModule],
  templateUrl: './header.html',
})
export class Header {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  /** Navega para a página de busca com o termo digitado. */
  search(term: string): void {
    const q = term.trim();
    if (!q) return;
    void this.router.navigate(['/busca'], { queryParams: { q } });
  }

  // Categorias-raiz (por jogo). Depois serão carregadas do Supabase.
  protected readonly games: NavItem[] = [
    { label: 'Pokémon', slug: 'pokemon' },
    { label: 'Magic', slug: 'magic' },
    { label: 'Yu-Gi-Oh!', slug: 'yugioh' },
    { label: 'One Piece', slug: 'one-piece' },
    { label: 'Lorcana', slug: 'lorcana' },
    { label: 'Dragon Ball', slug: 'dragon-ball' },
    { label: 'Acessórios', slug: 'acessorios' },
  ];

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
