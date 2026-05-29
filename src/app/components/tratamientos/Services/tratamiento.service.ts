import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Tratamiento } from '../Models/tratamiento.model';

@Injectable({ providedIn: 'root' })
export class TratamientoService {
  private readonly PATH = '/api/tratamientos';

  constructor(private api: ApiService) {}

  getAll(): Observable<Tratamiento[]> {
    return this.api.get<Tratamiento[]>(this.PATH);
  }

  getById(id: number): Observable<Tratamiento> {
    return this.api.get<Tratamiento>(`${this.PATH}/${id}`);
  }

  getByPaciente(pacienteId: number): Observable<Tratamiento[]> {
    return this.api.get<Tratamiento[]>(`${this.PATH}/paciente/${pacienteId}`);
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
