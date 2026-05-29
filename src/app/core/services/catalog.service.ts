import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { CatalogItem, Sede } from '../models/catalog.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private api: ApiService) {}

  private get<T>(path: string): Observable<T[]> {
    return this.api.get<T[]>(path).pipe(catchError(() => of([] as T[])));
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
}
