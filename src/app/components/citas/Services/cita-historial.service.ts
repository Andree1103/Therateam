import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CitaHistorial } from '../Models/cita-historial.model';

@Injectable({ providedIn: 'root' })
export class CitaHistorialService {
  private readonly PATH = '/api/cita-historial';

  constructor(private api: ApiService) {}

  getAll(): Observable<CitaHistorial[]> {
    return this.api.get<CitaHistorial[]>(this.PATH);
  }

  getByCita(citaId: number): Observable<CitaHistorial[]> {
    return this.api.get<CitaHistorial[]>(`${this.PATH}/cita/${citaId}`);
  }

  getById(id: number): Observable<CitaHistorial> {
    return this.api.get<CitaHistorial>(`${this.PATH}/${id}`);
  }

  create(historial: Partial<CitaHistorial>): Observable<CitaHistorial> {
    return this.api.post<CitaHistorial>(this.PATH, historial);
  }
}
