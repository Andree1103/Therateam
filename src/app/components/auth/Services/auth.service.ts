import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';
  private isBrowser: boolean;

  constructor(
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

  login(email: string, password: string): boolean {
    if (email === 'admin@therateam.com' && password === 'admin123') {
      const user: User = {
        id: '1',
        nombre: 'Administrador',
        apellido: 'Therateam',
        email: email,
        rol: 'ADMIN'
      };
      
      if (this.isBrowser) {
        localStorage.setItem(this.TOKEN_KEY, 'fake-jwt-token');
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }
      this.currentUserSubject.next(user);
      return true;
    }
    
    if (email === 'terapeuta@therateam.com' && password === 'terapeuta123') {
      const user: User = {
        id: '2',
        nombre: 'María',
        apellido: 'González',
        email: email,
        rol: 'TERAPEUTA'
      };
      
      if (this.isBrowser) {
        localStorage.setItem(this.TOKEN_KEY, 'fake-jwt-token');
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }
      this.currentUserSubject.next(user);
      return true;
    }
    
    return false;
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
}