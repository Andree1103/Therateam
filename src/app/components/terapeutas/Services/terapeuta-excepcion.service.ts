import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { TerapeutaExcepcion } from '../Models/terapeuta-horario.model';

@Injectable({ providedIn: 'root' })
export class TerapeutaExcepcionService {
  private readonly PATH = '/api/terapeuta-excepciones';

  constructor(private api: ApiService) {}

  getAll(): Observable<TerapeutaExcepcion[]> {
    return this.api.get<TerapeutaExcepcion[]>(this.PATH);
  }

  getByTerapeuta(terapeutaId: number): Observable<TerapeutaExcepcion[]> {
    return this.api.get<TerapeutaExcepcion[]>(`${this.PATH}/terapeuta/${terapeutaId}`);
  }

  getById(id: number): Observable<TerapeutaExcepcion> {
    return this.api.get<TerapeutaExcepcion>(`${this.PATH}/${id}`);
  }

  create(excepcion: Partial<TerapeutaExcepcion>): Observable<TerapeutaExcepcion> {
    return this.api.post<TerapeutaExcepcion>(this.PATH, excepcion);
  }

  update(id: number, excepcion: Partial<TerapeutaExcepcion>): Observable<TerapeutaExcepcion> {
    return this.api.put<TerapeutaExcepcion>(`${this.PATH}/${id}`, excepcion);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }
}
