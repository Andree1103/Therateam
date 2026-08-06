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
    if (this.isBrowser) {
      return !!localStorage.getItem(this.TOKEN_KEY);
    }
    return false;
  }

  getToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  /** true si el usuario logueado tiene acceso al módulo (ej. 'CITAS', 'PAGOS'). */
  tieneModulo(modulo: string): boolean {
    return this.currentUserValue?.modulos?.includes(modulo) ?? false;
  }

  /** false solo si el usuario está explícitamente restringido a no crear citas (configurable en Seguridad). */
  puedeCrearCitas(): boolean {
    return this.currentUserValue?.citasPuedeCrear ?? true;
  }

  private permisoDe(modulo: string): Permiso | undefined {
    return this.currentUserValue?.permisos?.find(p => p.modulo === modulo);
  }

  /** Permiso granular de escritura por módulo (ej. 'PACIENTES', 'PAGOS') — independiente de tieneModulo(). */
  puedeCrear(modulo: string): boolean { return this.permisoDe(modulo)?.crear ?? false; }
  puedeEditar(modulo: string): boolean { return this.permisoDe(modulo)?.editar ?? false; }
  puedeEliminar(modulo: string): boolean { return this.permisoDe(modulo)?.eliminar ?? false; }
}
