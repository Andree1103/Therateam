import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Pago } from '../Models/pago.model';
import { TratamientoBasico } from '../Models/pago.model';

interface PageResponse<T> {
  content: T[];
}

@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly PATH = '/api/pagos';

  constructor(private api: ApiService) {}

  getAll(): Observable<Pago[]> {
    return this.api.get<Pago[]>(this.PATH);
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
