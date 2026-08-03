import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../Services/auth.service';

/**
 * Bloquea el acceso a una ruta si el usuario logueado no tiene el módulo requerido
 * (route.data['modulo']). Si la ruta no declara módulo, solo exige estar autenticado.
 */
export const moduloGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const moduloRequerido = route.data?.['modulo'] as string | undefined;
  if (moduloRequerido && !authService.tieneModulo(moduloRequerido)) {
    router.navigate(['/sin-acceso']);
    return false;
  }

  return true;
};
