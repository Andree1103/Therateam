import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Terapeuta, TerapeutaCompletoRequest, terapeutaNombre } from '../Models/terapeuta.model';
import { PageResponse } from '../../../core/models/page.model';

export interface TerapeutaFiltros {
  nombre?: string;
  cmp?: string;
  areaId?: number | null;
  activo?: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class TerapeutaService {
  private readonly PATH = '/api/terapeutas';

  constructor(private api: ApiService) {}

  getAll(): Observable<Terapeuta[]> {
    return this.api.get<PageResponse<Terapeuta> | Terapeuta[]>(this.PATH, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
  }

  /** Para el listado paginado (server-side): page 0-based, tamaño y filtros por campo separado. */
  getAllPaged(page: number, size: number, filtros: TerapeutaFiltros = {}): Observable<PageResponse<Terapeuta>> {
    return this.api.get<PageResponse<Terapeuta>>(this.PATH, {
      page: String(page), size: String(size),
      nombre: filtros.nombre?.trim() || undefined,
      cmp: filtros.cmp?.trim() || undefined,
      areaId: filtros.areaId != null ? String(filtros.areaId) : undefined,
      activo: filtros.activo == null ? undefined : String(filtros.activo),
    });
  }

  getById(id: number): Observable<Terapeuta> {
    return this.api.get<Terapeuta>(`${this.PATH}/${id}`);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }

  createCompleto(body: TerapeutaCompletoRequest): Observable<Terapeuta> {
    return this.api.post<Terapeuta>(`${this.PATH}/completo`, body);
  }

  updateCompleto(id: number, body: TerapeutaCompletoRequest): Observable<Terapeuta> {
    return this.api.put<Terapeuta>(`${this.PATH}/${id}/completo`, body);
  }

  getParaDropdown(): Observable<{ id: number; nombre: string }[]> {
    return this.getAll().pipe(
      map(list => list.map(t => ({ id: t.id!, nombre: terapeutaNombre(t) })))
    );
  }
}
