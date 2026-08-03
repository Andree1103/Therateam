import { Component, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../auth/Services/auth.service';
import { ToastComponent } from '../../core/components/toast/toast.component';
import { CatalogService } from '../../core/services/catalog.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {
  menuAbierto  = false;
  cerrado      = false;   // sidebar colapsado (desktop)
  movilAbierto = false;   // sidebar abierto (mobile overlay)

  constructor(
    private authService: AuthService,
    private catalogService: CatalogService,
    private toast: ToastService,
  ) {}

  get user(): User | null { return this.authService.currentUserValue; }

  tieneModulo(modulo: string): boolean { return this.authService.tieneModulo(modulo); }

  get iniciales(): string {
    const u = this.user;
    if (!u) return '??';
    return `${u.nombre.charAt(0)}${u.apellido.charAt(0)}`.toUpperCase();
  }

  get rolLabel(): string {
    const map: Record<string, string> = {
      ADMIN: 'Admin', TERAPEUTA: 'Terapeuta', RECEPCIONISTA: 'Recepcionista',
      CAJERO: 'Cajero', OPERACIONES: 'Operaciones',
    };
    return map[this.user?.rol ?? ''] ?? (this.user?.rol ?? '');
  }

  toggleUser(e: MouseEvent): void { e.stopPropagation(); this.menuAbierto = !this.menuAbierto; }
  toggleSidebar(): void { this.cerrado = !this.cerrado; }
  abrirMovil(): void { this.movilAbierto = true; }
  cerrarMovil(): void { this.movilAbierto = false; }

  @HostListener('document:click')
  onDocClick(): void { this.menuAbierto = false; }

  logout(): void { this.authService.logout(); }

  /** Fuerza que los catálogos (especialidades, áreas, estados, etc.) se vuelvan a pedir al backend
   * la próxima vez que se usen — para cuando otro usuario editó algo en Configuraciones mientras
   * esta pestaña ya tenía la versión vieja en memoria. */
  actualizarCatalogos(): void {
    this.catalogService.invalidate();
    this.toast.success('Catálogos actualizados');
    this.menuAbierto = false;
  }
}
