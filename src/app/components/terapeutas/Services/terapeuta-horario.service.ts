import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { TerapeutaHorario } from '../Models/terapeuta-horario.model';

@Injectable({ providedIn: 'root' })
export class TerapeutaHorarioService {
  private readonly PATH = '/api/terapeuta-horarios';

  constructor(private api: ApiService) {}

  getAll(): Observable<TerapeutaHorario[]> {
    return this.api.get<TerapeutaHorario[]>(this.PATH);
  }

  getByTerapeuta(terapeutaId: number): Observable<TerapeutaHorario[]> {
    return this.api.get<TerapeutaHorario[]>(`${this.PATH}/terapeuta/${terapeutaId}`);
  }

  getById(id: number): Observable<TerapeutaHorario> {
    return this.api.get<TerapeutaHorario>(`${this.PATH}/${id}`);
  }

  create(horario: Partial<TerapeutaHorario>): Observable<TerapeutaHorario> {
    return this.api.post<TerapeutaHorario>(this.PATH, horario);
  }

  update(id: number, horario: Partial<TerapeutaHorario>): Observable<TerapeutaHorario> {
    return this.api.put<TerapeutaHorario>(`${this.PATH}/${id}`, horario);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }
}
