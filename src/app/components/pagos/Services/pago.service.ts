import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Pago } from '../Models/pago.model';
import { TratamientoBasico } from '../Models/pago.model';
import { PageResponse } from '../../../core/models/page.model';

export interface PagoFiltros {
  paciente?: string;
  referencia?: string;
  metodoId?: number | null;
  /** true = solo pagos ligados a un paquete, false = solo pagos sin paquete (cita suelta) */
  tienePaquete?: boolean | null;
  montoMin?: number | null;
  montoMax?: number | null;
  /** ISO datetime, ej. 2026-08-01T00:00:00 */
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly PATH = '/api/pagos';

  constructor(private api: ApiService) {}

  getAll(): Observable<Pago[]> {
    return this.api.get<PageResponse<Pago> | Pago[]>(this.PATH, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
  }

  /** Para el listado paginado (server-side): page 0-based, tamaño, búsqueda y filtros por back. */
  getAllPaged(page: number, size: number, filtros: PagoFiltros = {}): Observable<PageResponse<Pago>> {
    return this.api.get<PageResponse<Pago>>(this.PATH, {
      page: String(page), size: String(size),
      paciente: filtros.paciente?.trim() || undefined,
      referencia: filtros.referencia?.trim() || undefined,
      metodoId: filtros.metodoId != null ? String(filtros.metodoId) : undefined,
      tienePaquete: filtros.tienePaquete == null ? undefined : String(filtros.tienePaquete),
      montoMin: filtros.montoMin != null ? String(filtros.montoMin) : undefined,
      montoMax: filtros.montoMax != null ? String(filtros.montoMax) : undefined,
      fechaInicio: filtros.fechaInicio || undefined,
      fechaFin: filtros.fechaFin || undefined,
    });
  }

  getByPaciente(pacienteId: number): Observable<Pago[]> {
    return this.api.get<Pago[]>(`${this.PATH}/paciente/${pacienteId}`);
  }

  /** /api/tratamientos/paciente/{id} devuelve un Page<TratamientoDTO> — se extrae el contenido. */
  getTratamientosByPaciente(pacienteId: number): Observable<TratamientoBasico[]> {
    return this.api.get<PageResponse<TratamientoBasico>>(`/api/tratamientos/paciente/${pacienteId}?size=100`)
      .pipe(map(page => page.content));
  }

  create(pago: Partial<Pago>): Observable<Pago> {
    return this.api.post<Pago>(this.PATH, pago);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }
}
