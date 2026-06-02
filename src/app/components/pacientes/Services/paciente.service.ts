import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Paciente } from '../Models/paciente.model';
import { PageResponse } from '../../../core/models/page.model';

@Injectable({ providedIn: 'root' })
export class PacienteService {
  private readonly PATH = '/api/pacientes';

  constructor(private api: ApiService) {}

  getAll(): Observable<Paciente[]> {
    return this.api.get<PageResponse<Paciente> | Paciente[]>(this.PATH, { size: '1000' }).pipe(
      map(r => Array.isArray(r) ? r : r.content)
    );
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
