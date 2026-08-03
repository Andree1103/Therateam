import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Paciente } from '../Models/paciente.model';
import { PageResponse } from '../../../core/models/page.model';

export interface PacienteFiltros {
  nombre?: string;
  dni?: string;
  correo?: string;
  sedeId?: number | null;
  activo?: boolean | null;
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
    });
  }

  getById(id: number): Observable<Paciente> {
    return this.api.get<Paciente>(`${this.PATH}/${id}`);
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
