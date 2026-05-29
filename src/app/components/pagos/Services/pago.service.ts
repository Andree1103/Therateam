import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Pago } from '../Models/pago.model';
import { TratamientoBasico } from '../Models/pago.model';

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

  getTratamientosByPaciente(pacienteId: number): Observable<TratamientoBasico[]> {
    return this.api.get<TratamientoBasico[]>(`/api/tratamientos/paciente/${pacienteId}`);
  }

  create(pago: Partial<Pago>): Observable<Pago> {
    return this.api.post<Pago>(this.PATH, pago);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }
}
