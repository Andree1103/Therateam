import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Paciente, SaldoMovimiento } from '../Models/paciente.model';
import { PageResponse } from '../../../core/models/page.model';
import { HorarioFijo, HorarioFijoRequest, HorarioFijoResumen } from '../Models/horario-fijo.model';

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
    return this.api.getTodo<Paciente>(this.PATH);
  }

  /** Los filtros tal como viajan en la consulta. Uno solo para la pagina y para el Excel: si
   *  cada uno los armara por su cuenta, el archivo acabaria respondiendo a otros filtros que
   *  los de la pantalla. */
  private paramsDe(filtros: PacienteFiltros): Record<string, string | undefined> {
    return {
      nombre: filtros.nombre?.trim() || undefined,
      dni: filtros.dni?.trim() || undefined,
      correo: filtros.correo?.trim() || undefined,
      sedeId: filtros.sedeId != null ? String(filtros.sedeId) : undefined,
      activo: filtros.activo == null ? undefined : String(filtros.activo),
      creadoDesde: filtros.creadoDesde || undefined,
      creadoHasta: filtros.creadoHasta || undefined,
    };
  }

  /** Para el listado paginado (server-side): page 0-based, tamaño y filtros por campo separado. */
  getAllPaged(page: number, size: number, filtros: PacienteFiltros = {}): Observable<PageResponse<Paciente>> {
    return this.api.get<PageResponse<Paciente>>(this.PATH, {
      page: String(page), size: String(size), ...this.paramsDe(filtros),
    });
  }

  /**
   * Trae TODO lo que cumpla los filtros, sin tope: pide las paginas que haga falta.
   *
   * Lo usa el Excel. Antes pedia una sola pagina de 10.000 filas, que es un numero que hoy
   * alcanza y manana no --y cuando no alcance, el archivo saldra corto sin decir nada, que es
   * justo lo que paso con el de citas--. Ver ApiService.getTodo.
   */
  getTodoFiltrado(filtros: PacienteFiltros = {}): Observable<Paciente[]> {
    return this.api.getTodo<Paciente>(this.PATH, this.paramsDe(filtros));
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

  /**
   * Los horarios fijos en una sola llamada, acotados por los MISMOS filtros que el listado de
   * pacientes.
   *
   * Existe para exportar: pedirlos paciente por paciente serían cien peticiones para cien
   * pacientes, y traerse el cuadro entero para recortarlo aquí es cargar memoria por nada. El
   * back los devuelve aplanados, con el nombre del paciente ya resuelto.
   */
  getHorariosFijosDeTodos(filtros: PacienteFiltros = {}): Observable<HorarioFijoResumen[]> {
    return this.api.get<HorarioFijoResumen[]>('/api/horarios-fijos', {
      nombre: filtros.nombre?.trim() || undefined,
      dni: filtros.dni?.trim() || undefined,
      correo: filtros.correo?.trim() || undefined,
      sedeId: filtros.sedeId != null ? String(filtros.sedeId) : undefined,
      activo: filtros.activo == null ? undefined : String(filtros.activo),
      creadoDesde: filtros.creadoDesde || undefined,
      creadoHasta: filtros.creadoHasta || undefined,
    });
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

  /** Todos los pacientes con saldo a favor que cumplan el filtro, para el Excel. */
  getTodosLosAdelantos(nombre?: string): Observable<Paciente[]> {
    return this.api.getTodo<Paciente>(`${this.PATH}/adelantos`,
      { nombre: nombre?.trim() || undefined });
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

  /**
   * Baja a mano el saldo a favor, hasta cero si hace falta.
   *
   * `tipo` dice qué pasó con el dinero, y de eso depende si la caja se mueve: DEVOLUCION se le
   * entregó (sale del arqueo del turno), CORRECCION es un número mal puesto (no sale nada).
   */
  ajustarSaldo(id: number, body: { nuevoSaldo: number; tipo: 'DEVOLUCION' | 'CORRECCION';
                                   metodoId?: number | null; motivo: string }): Observable<Paciente> {
    return this.api.post<Paciente>(`${this.PATH}/${id}/ajustar-saldo`, body);
  }

  /** Dar de baja o volver a dar de alta, sin reenviar la ficha entera. */
  cambiarActivo(id: number, activo: boolean): Observable<Paciente> {
    return this.api.patch<Paciente>(`${this.PATH}/${id}/activo`, null, { activo: String(activo) });
  }
}
