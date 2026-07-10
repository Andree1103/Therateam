import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { PagoSesion } from '../Models/pago-sesion.model';

@Injectable({ providedIn: 'root' })
export class PagoSesionService {
  private readonly PATH = '/api/pago-sesiones';

  constructor(private api: ApiService) {}

  getAll(): Observable<PagoSesion[]> {
    return this.api.get<PagoSesion[]>(this.PATH);
  }

  getByPago(pagoId: number): Observable<PagoSesion[]> {
    return this.api.get<PagoSesion[]>(`${this.PATH}/pago/${pagoId}`);
  }

  getBySesion(sesionId: number): Observable<PagoSesion[]> {
    return this.api.get<PagoSesion[]>(`${this.PATH}/sesion/${sesionId}`);
  }

  getById(id: number): Observable<PagoSesion> {
    return this.api.get<PagoSesion>(`${this.PATH}/${id}`);
  }

  create(pagoSesion: Partial<PagoSesion>): Observable<PagoSesion> {
    return this.api.post<PagoSesion>(this.PATH, pagoSesion);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }
}
