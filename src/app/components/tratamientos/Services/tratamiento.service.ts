import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Tratamiento, TratamientoDetalle, Sesion, TratamientoCobertura } from '../Models/tratamiento.model';
import { PageResponse } from '../../../core/models/page.model';

export interface TratamientoFiltros {
  paciente?: string;
  terapeuta?: string;
  tipoTerapiaId?: number | null;
  estado?: string;
}

@Injectable({ providedIn: 'root' })
export class TratamientoService {
  private readonly PATH = '/api/tratamientos';

  constructor(private api: ApiService) {}

  getAll(): Observable<Tratamiento[]> {
    return this.api.get<PageResponse<Tratamiento> | Tratamiento[]>(this.PATH, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
  }

  /** Para el listado paginado (server-side): page 0-based, tamaño y filtros por campo separado. */
  getAllPaged(page: number, size: number, filtros: TratamientoFiltros = {}): Observable<PageResponse<Tratamiento>> {
    return this.api.get<PageResponse<Tratamiento>>(this.PATH, {
      page: String(page), size: String(size),
      paciente: filtros.paciente?.trim() || undefined,
      terapeuta: filtros.terapeuta?.trim() || undefined,
      tipoTerapiaId: filtros.tipoTerapiaId != null ? String(filtros.tipoTerapiaId) : undefined,
      estado: filtros.estado || undefined,
    });
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

  getCobertura(tratamientoId: number): Observable<TratamientoCobertura> {
    return this.api.get<TratamientoCobertura>(`${this.PATH}/${tratamientoId}/cobertura`);
  }

  getByPaciente(pacienteId: number): Observable<Tratamiento[]> {
    return this.api.get<PageResponse<Tratamiento> | Tratamiento[]>(`${this.PATH}/paciente/${pacienteId}`, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
  }

  getByTerapeuta(terapeutaId: number): Observable<Tratamiento[]> {
    return this.api.get<Tratamiento[]>(`${this.PATH}/terapeuta/${terapeutaId}`);
  }

  /** Reporte de adelantos: paquetes con saldo a favor (pagado de más contra lo ya consumido). */
  getAdelantos(page: number, size: number, paciente?: string): Observable<PageResponse<Tratamiento>> {
    return this.api.get<PageResponse<Tratamiento>>(`${this.PATH}/adelantos`, {
      page: String(page), size: String(size),
      paciente: paciente?.trim() || undefined,
    });
  }

  create(t: any): Observable<Tratamiento> {
    return this.api.post<Tratamiento>(this.PATH, t);
  }

  update(id: number, t: any): Observable<Tratamiento> {
    return this.api.put<Tratamiento>(`${this.PATH}/${id}`, t);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }

  /** Anula todas las citas pendientes del paquete (no toca las ya atendidas ni las ya canceladas). */
  anularPaquete(id: number, devolucion: 'SALDO' | 'DINERO' = 'SALDO', metodoId?: number | null): Observable<unknown> {
    const qs = metodoId != null ? `?devolucion=${devolucion}&metodoId=${metodoId}` : `?devolucion=${devolucion}`;
    return this.api.post<unknown>(`${this.PATH}/${id}/anular${qs}`, {});
  }
}
