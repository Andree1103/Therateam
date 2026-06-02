import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Tratamiento, TratamientoDetalle, Sesion } from '../Models/tratamiento.model';
import { PageResponse } from '../../../core/models/page.model';

@Injectable({ providedIn: 'root' })
export class TratamientoService {
  private readonly PATH = '/api/tratamientos';

  constructor(private api: ApiService) {}

  getAll(): Observable<Tratamiento[]> {
    return this.api.get<PageResponse<Tratamiento> | Tratamiento[]>(this.PATH, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
  }

  getById(id: number): Observable<Tratamiento> {
    return this.api.get<Tratamiento>(`${this.PATH}/${id}`);
  }

  getDetalle(id: number): Observable<TratamientoDetalle> {
    return this.api.get<TratamientoDetalle>(`${this.PATH}/${id}`);
  }

  getSesiones(tratamientoId: number): Observable<Sesion[]> {
    return this.api.get<Sesion[]>(`${this.PATH}/${tratamientoId}/sesiones`);
  }

  getByPaciente(pacienteId: number): Observable<Tratamiento[]> {
    return this.api.get<PageResponse<Tratamiento> | Tratamiento[]>(`${this.PATH}/paciente/${pacienteId}`, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
  }

  getByTerapeuta(terapeutaId: number): Observable<Tratamiento[]> {
    return this.api.get<Tratamiento[]>(`${this.PATH}/terapeuta/${terapeutaId}`);
  }

  create(t: Partial<Tratamiento>): Observable<Tratamiento> {
    return this.api.post<Tratamiento>(this.PATH, t);
  }

  update(id: number, t: Partial<Tratamiento>): Observable<Tratamiento> {
    return this.api.put<Tratamiento>(`${this.PATH}/${id}`, t);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }
}
