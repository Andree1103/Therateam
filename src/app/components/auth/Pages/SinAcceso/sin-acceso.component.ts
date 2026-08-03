import { Component } from '@angular/core';
import { AuthService } from '../../Services/auth.service';

@Component({
  selector: 'app-sin-acceso',
  standalone: true,
  template: `
    <div class="sin-acceso">
      <h1>Sin acceso</h1>
      <p>Tu usuario no tiene permiso para ver este módulo.</p>
      <button (click)="volver()">Volver</button>
    </div>
  `,
  styles: [`
    .sin-acceso{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;font-family:'DM Sans',system-ui,sans-serif;color:#0f172a;text-align:center;padding:24px}
    h1{font-size:20px;margin:0}
    p{color:#64748b;margin:0;font-size:14px}
    button{margin-top:8px;padding:9px 18px;border:none;border-radius:8px;background:#185FA5;color:#fff;font-weight:600;cursor:pointer;font-family:inherit}
  `]
})
export class SinAccesoComponent {
  constructor(private authService: AuthService) {}

  /**
   * "Volver" cierra sesión en vez de solo navegar a '/' — si el token guardado quedó desactualizado
   * (ej. tras un cambio de roles/permisos en el back), navegar a '/' vuelve a caer en el mismo guard
   * y regresa aquí en loop. Cerrar sesión fuerza un login limpio con permisos frescos.
   */
  volver(): void { this.authService.logout(); }
}
