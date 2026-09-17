import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Paciente, SaldoMovimiento } from '../Models/paciente.model';
import { PageResponse } from '../../../core/models/page.model';
import { HorarioFijo, HorarioFijoRequest } from '../Models/horario-fijo.model';

export interface PacienteFiltros {
  nombre?: string;
  dni?: string;
  correo?: string;
  sedeId?: number | null;
  activo?: boolean | null;
  /** Fecha de alta del paciente (yyyy-MM-dd, dias completos) — se usa para exportar solo los nuevos. */
  creadoDesde?: string | null;
  creadoHasta?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PacienteService {
  private readonly PATH = '/api/pacientes';

  constructor(private api: ApiService) {}

  getAll(): Observable<Paciente[]> {
    return this.api.get<PageResponse<Paciente> | Paciente[]>(this.PATH, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
  }

  /** Para el listado paginado (server-side): page 0-based, tamaño y filtros por campo separado. */
  getAllPaged(page: number, size: number, filtros: PacienteFiltros = {}): Observable<PageResponse<Paciente>> {
    return this.api.get<PageResponse<Paciente>>(this.PATH, {
      page: String(page), size: String(size),
      nombre: filtros.nombre?.trim() || undefined,
      dni: filtros.dni?.trim() || undefined,
      correo: filtros.correo?.trim() || undefined,
      sedeId: filtros.sedeId != null ? String(filtros.sedeId) : undefined,
      activo: filtros.activo == null ? undefined : String(filtros.activo),
      creadoDesde: filtros.creadoDesde || undefined,
      creadoHasta: filtros.creadoHasta || undefined,
    });
  }

  /** Reporte de adelantos: pacientes con saldo a favor disponible. */
  /** Estado de cuenta del saldo a favor: de donde salio y en que se gasto. */
  getSaldoMovimientos(pacienteId: number): Observable<SaldoMovimiento[]> {
    return this.api.get<SaldoMovimiento[]>(`${this.PATH}/${pacienteId}/saldo-movimientos`);
  }

  /** Horario habitual del paciente — solo referencia, no reserva la agenda ni crea citas. */
  getHorariosFijos(pacienteId: number): Observable<HorarioFijo[]> {
    return this.api.get<HorarioFijo[]>(`${this.PATH}/${pacienteId}/horarios-fijos`);
  }

  /** Reemplaza el horario completo. Una lista vacía deja al paciente sin horarios fijos. */
  guardarHorariosFijos(pacienteId: number, horarios: HorarioFijoRequest[]): Observable<HorarioFijo[]> {
    return this.api.put<HorarioFijo[]>(`${this.PATH}/${pacienteId}/horarios-fijos`, horarios);
  }

  getAdelantos(page: number, size: number, nombre?: string): Observable<PageResponse<Paciente>> {
    return this.api.get<PageResponse<Paciente>>(`${this.PATH}/adelantos`, {
      page: String(page), size: String(size),
      nombre: nombre?.trim() || undefined,
    });
  }

  getById(id: number): Observable<Paciente> {
    return this.api.get<Paciente>(`${this.PATH}/${id}`);
  }

  /** Búsqueda exacta por DNI — null si no existe (usado para vincular o dar de alta al vuelo). */
  buscarPorDni(dni: string): Observable<Paciente | null> {
    return this.api.get<Paciente>(`${this.PATH}/buscar`, { dni }).pipe(
      catchError(() => of(null))
    );
  }

  create(paciente: Partial<Paciente>): Observable<Paciente> {
    return this.api.post<Paciente>(this.PATH, paciente);
  }

  update(id: number, paciente: Partial<Paciente>): Observable<Paciente> {
    return this.api.put<Paciente>(`${this.PATH}/${id}`, paciente);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }
}
