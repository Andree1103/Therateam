import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CatalogItem, Sede } from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private api: ApiService) {}

  /** Cache en memoria por endpoint: se pide una sola vez y se reusa hasta que se invalide. */
  private cache = new Map<string, Observable<unknown[]>>();

  private get<T>(path: string): Observable<T[]> {
    let cached = this.cache.get(path);
    if (!cached) {
      cached = this.api.get<T[]>(path).pipe(
        catchError(() => of([] as T[])),
        shareReplay(1),
      );
      this.cache.set(path, cached);
    }
    return cached as Observable<T[]>;
  }

  /** Descarta el cache de un catálogo (o de todos si no se indica) — llamar tras crear/editar/eliminar. */
  invalidate(path?: string): void {
    if (path) this.cache.delete(path);
    else this.cache.clear();
  }

  getSedes(): Observable<Sede[]>               { return this.get<Sede>('/api/sedes'); }
  getOrigenes(): Observable<CatalogItem[]>      { return this.get<CatalogItem>('/api/cat-origenes'); }
  getEspecialidades(): Observable<CatalogItem[]>{ return this.get<CatalogItem>('/api/cat-especialidades'); }
  getTiposTerapeuta(): Observable<CatalogItem[]>{ return this.get<CatalogItem>('/api/cat-tipos-terapeuta'); }
  getMetodosPago(): Observable<CatalogItem[]>   { return this.get<CatalogItem>('/api/cat-metodos-pago'); }
  getModalidades(): Observable<CatalogItem[]>   { return this.get<CatalogItem>('/api/cat-modalidades'); }
  getMonedas(): Observable<CatalogItem[]>       { return this.get<CatalogItem>('/api/cat-monedas'); }
  getRoles(): Observable<CatalogItem[]>         { return this.get<CatalogItem>('/api/cat-roles'); }
  getEstadosCita(): Observable<CatalogItem[]>   { return this.get<CatalogItem>('/api/cat-estados-cita'); }
  getEstadosSesion(): Observable<CatalogItem[]> { return this.get<CatalogItem>('/api/cat-estados-sesion'); }
  getEstadosTratamiento(): Observable<CatalogItem[]> { return this.get<CatalogItem>('/api/cat-estados-tratamiento'); }
  getTiposTerapia(): Observable<CatalogItem[]>  { return this.get<CatalogItem>('/api/tipos-terapia'); }
  getTurnos(): Observable<CatalogItem[]>        { return this.get<CatalogItem>('/api/cat-turnos'); }
  getAreas(): Observable<CatalogItem[]>         { return this.get<CatalogItem>('/api/cat-areas'); }
  getEstadosPagoCita(): Observable<CatalogItem[]> { return this.get<CatalogItem>('/api/cat-estados-pago-cita'); }
  getPlantillasPaquete(): Observable<CatalogItem[]> { return this.get<CatalogItem>('/api/plantillas-paquete'); }
  getModulos(): Observable<CatalogItem[]>       { return this.get<CatalogItem>('/api/modulos'); }
}
