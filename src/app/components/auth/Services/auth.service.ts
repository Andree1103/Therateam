import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';

export interface Permiso {
  modulo: string;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export interface User {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  modulos: string[];
  permisos: Permiso[];
  terapeutaId: number | null;
  citasSoloPropias: boolean;
  citasPuedeCrear: boolean;
  pacientesVerTelefono: boolean;
}

interface LoginResponse {
  token: string;
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  modulos: string[];
  permisos: Permiso[];
  terapeutaId: number | null;
  citasSoloPropias: boolean;
  citasPuedeCrear: boolean;
  pacientesVerTelefono: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    let storedUser = null;
    if (this.isBrowser) {
      // Si el token guardado ya vencio (dura 10h: volver al dia siguiente basta), la sesion se
      // descarta ACA, antes de que ningun componente pida nada. Si no, la app dejaba entrar con
      // el token muerto, disparaba todos los catalogos, recibia 401 en cada uno y recien
      // entonces mandaba al login — dejando los selects vacios hasta recargar.
      if (this.tokenVencido(localStorage.getItem(this.TOKEN_KEY))) {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
      }
      storedUser = localStorage.getItem(this.USER_KEY);
    }

    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, { email, password }).pipe(
      map(res => {
        const user: User = {
          id: res.id, nombre: res.nombre, apellido: res.apellido,
          email: res.email, rol: res.rol, modulos: res.modulos, permisos: res.permisos ?? [],
          terapeutaId: res.terapeutaId, citasSoloPropias: res.citasSoloPropias,
          citasPuedeCrear: res.citasPuedeCrear,
          pacientesVerTelefono: res.pacientesVerTelefono,
        };
        if (this.isBrowser) {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        }
        this.currentUserSubject.next(user);
        return user;
      })
    );
  }

  /** Siempre responde con un mensaje genérico (exista o no el correo) — no revela qué correos están registrados. */
  forgotPassword(email: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/api/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/api/auth/reset-password`, { token, newPassword });
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** null tambien cuando el token existe pero ya vencio — mandarlo solo genera 401. */
  getToken(): string | null {
    if (!this.isBrowser) return null;
    const token = localStorage.getItem(this.TOKEN_KEY);
    return this.tokenVencido(token) ? null : token;
  }

  /**
   * true si el JWT ya paso su `exp`. Es una lectura local del payload, sin validar la firma:
   * sirve para no gastar peticiones que el backend va a rechazar igual, no como control de
   * seguridad — de eso se encarga el servidor.
   *
   * Un token ilegible se trata como vencido: si no se puede leer, no sirve para nada.
   */
  private tokenVencido(token: string | null): boolean {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.exp) return false; // sin exp, que decida el backend
      return payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  /** true si el usuario logueado tiene acceso al módulo (ej. 'CITAS', 'PAGOS'). */
  tieneModulo(modulo: string): boolean {
    return this.currentUserValue?.modulos?.includes(modulo) ?? false;
  }

  /** false solo si el usuario está explícitamente restringido a no crear citas (configurable en Seguridad). */
  puedeCrearCitas(): boolean {
    return this.currentUserValue?.citasPuedeCrear ?? true;
  }

  /** Dato sensible: true solo si el usuario tiene el permiso activado explícitamente en Seguridad
   *  (a diferencia de puedeCrearCitas, acá el default es NO ver). */
  puedeVerTelefonoPacientes(): boolean {
    return this.currentUserValue?.pacientesVerTelefono ?? false;
  }

  /** Rol ADMIN exacto — para acciones sensibles que no dependen del permiso granular por módulo (ej. editar terapeuta/monto de una cita ya creada). */
  get esAdmin(): boolean {
    return this.currentUserValue?.rol === 'ADMIN';
  }

  private permisoDe(modulo: string): Permiso | undefined {
    return this.currentUserValue?.permisos?.find(p => p.modulo === modulo);
  }

  /** Permiso granular de escritura por módulo (ej. 'PACIENTES', 'PAGOS') — independiente de tieneModulo(). */
  puedeCrear(modulo: string): boolean { return this.permisoDe(modulo)?.crear ?? false; }
  puedeEditar(modulo: string): boolean { return this.permisoDe(modulo)?.editar ?? false; }
  puedeEliminar(modulo: string): boolean { return this.permisoDe(modulo)?.eliminar ?? false; }
}
