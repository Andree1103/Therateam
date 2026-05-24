import { Component, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../auth/Services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {
  menuAbierto  = false;
  cerrado      = false;   // sidebar colapsado (desktop)
  movilAbierto = false;   // sidebar abierto (mobile overlay)

  constructor(private authService: AuthService) {}

  get user(): User | null { return this.authService.currentUserValue; }

  get iniciales(): string {
    const u = this.user;
    if (!u) return '??';
    return `${u.nombre.charAt(0)}${u.apellido.charAt(0)}`.toUpperCase();
  }

  get rolLabel(): string {
    const map: Record<string, string> = { ADMIN: 'Admin', TERAPEUTA: 'Terapeuta', RECEPCION: 'Recepción' };
    return map[this.user?.rol ?? ''] ?? (this.user?.rol ?? '');
  }

  toggleUser(e: MouseEvent): void { e.stopPropagation(); this.menuAbierto = !this.menuAbierto; }
  toggleSidebar(): void { this.cerrado = !this.cerrado; }
  abrirMovil(): void { this.movilAbierto = true; }
  cerrarMovil(): void { this.movilAbierto = false; }

  @HostListener('document:click')
  onDocClick(): void { this.menuAbierto = false; }

  logout(): void { this.authService.logout(); }
}
