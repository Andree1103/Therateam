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

  /**
   * El paciente no vino: queda como una atencion de tipo INASISTENCIA, con su motivo.
   *
   * Va a Atenciones y no solo al estado de la cita porque "No asistio" en la agenda vive en una
   * semana que nadie vuelve a mirar; como fila se puede contar, filtrar y exportar.
   *
   * `devolver` decide que pasa con lo cobrado: false lo deja como ingreso de la clinica (la cita
   * sigue pagada); true se lo devuelve al paciente como saldo a favor.
   */
  registrarInasistencia(citaId: number, motivo: string, devolver = false): Observable<AtencionClinica> {
    return this.api.post<AtencionClinica>(`${this.PATH}/inasistencia`, { citaId, motivo, devolver });
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
