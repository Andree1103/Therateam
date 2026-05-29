import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CatalogItem, Sede } from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private api: ApiService) {}

  getSedes(): Observable<Sede[]> {
    return this.api.get<Sede[]>('/api/sedes').pipe(catchError(() => of([])));
  }

  getOrigenes(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>('/api/cat-origenes').pipe(catchError(() => of([])));
  }

  getMetodosPago(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>('/api/cat/metodos-pago').pipe(catchError(() => of([])));
  }

  getTiposTerapeuta(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>('/api/cat-tipos-terapeuta').pipe(catchError(() => of([])));
  }

  getEspecialidades(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>('/api/cat/especialidades').pipe(catchError(() => of([])));
  }

  getRoles(): Observable<CatalogItem[]> {
    return this.api.get<CatalogItem[]>('/api/cat/roles').pipe(catchError(() => of([])));
  }
}
