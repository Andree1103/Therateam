import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Configuracion {
  id: number;
  sede?: { id: number } | null;
  clave: string;
  valor: string;
  descripcion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private cache$: Observable<Configuracion[]> | null = null;

  constructor(private api: ApiService) {}

  getAll(): Observable<Configuracion[]> {
    if (!this.cache$) {
      this.cache$ = this.api.get<Configuracion[]>('/api/configuracion').pipe(
        catchError(() => of([] as Configuracion[])),
        shareReplay(1),
      );
    }
    return this.cache$;
  }

  /** Valores globales (sin sede) como mapa clave→valor — nombre_negocio, direccion, telefono, logo_url, etc. */
  getValores(): Observable<Record<string, string>> {
    return this.getAll().pipe(
      map(lista => lista
        .filter(c => !c.sede)
        .reduce((acc, c) => { acc[c.clave] = c.valor; return acc; }, {} as Record<string, string>))
    );
  }
}
