import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AtencionClinica } from '../Models/atencion.model';

@Injectable({ providedIn: 'root' })
export class AtencionClinicaService {
  private readonly PATH = '/api/atencion-clinica';

  constructor(private api: ApiService) {}

  crear(data: Partial<AtencionClinica>): Observable<AtencionClinica> {
    return this.api.post<AtencionClinica>(this.PATH, data);
  }

  getByCita(citaId: number): Observable<AtencionClinica> {
    return this.api.get<AtencionClinica>(`${this.PATH}/cita/${citaId}`);
  }

  /** Todas las atenciones del paciente en una sola petición — la alternativa era preguntar por
   *  cada cita suya por separado, con un 404 por cada una que todavía no se atendió. */
  getByPaciente(pacienteId: number): Observable<AtencionClinica[]> {
    return this.api.get<AtencionClinica[]>(`${this.PATH}/paciente/${pacienteId}`);
  }

  update(id: number, data: Partial<AtencionClinica>): Observable<AtencionClinica> {
    return this.api.put<AtencionClinica>(`${this.PATH}/${id}`, data);
  }
}
