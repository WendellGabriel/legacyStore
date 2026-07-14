import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-account',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  templateUrl: './account.html',
})
export class Account {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly nav = [
    { path: '/conta', label: 'Meu perfil', icon: 'person', exact: true },
    { path: '/conta/pedidos', label: 'Meus pedidos', icon: 'receipt_long', exact: false },
    { path: '/conta/enderecos', label: 'Endereços', icon: 'location_on', exact: false },
  ];

  async signOut(): Promise<void> {
    await this.auth.signOut();
    void this.router.navigateByUrl('/');
  }
}
