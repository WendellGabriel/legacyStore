import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-admin',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  templateUrl: './admin.html',
})
export class Admin {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly sidebarOpen = signal(false);

  protected readonly nav = [
    { path: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/admin/produtos', label: 'Produtos', icon: 'inventory_2', exact: false },
    { path: '/admin/categorias', label: 'Categorias', icon: 'category', exact: false },
    { path: '/admin/pedidos', label: 'Pedidos', icon: 'receipt_long', exact: false },
    { path: '/admin/estoque', label: 'Estoque', icon: 'warehouse', exact: false },
    { path: '/admin/banners', label: 'Banners', icon: 'image', exact: false },
    { path: '/admin/cupons', label: 'Cupons', icon: 'sell', exact: false },
    { path: '/admin/frete', label: 'Zonas de frete', icon: 'local_shipping', exact: false },
    { path: '/admin/clientes', label: 'Clientes', icon: 'group', exact: false },
  ];

  async signOut(): Promise<void> {
    await this.auth.signOut();
    void this.router.navigateByUrl('/');
  }
}
