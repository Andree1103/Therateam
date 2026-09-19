import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DisponibilidadDia } from '../Models/disponibilidad.model';

@Injectable({ providedIn: 'root' })
export class DisponibilidadService {
  constructor(private api: ApiService) {}

  /**
   * Las franjas libres de un terapeuta ese dia.
   *
   * `cupo` es cuantos pacientes admite a la vez la cita que se quiere colocar. Sin el, el back
   * mide el hueco con el cupo de las citas que YA estan: una Terapia Fisica (2 pacientes) sola
   * dejaba el hueco como libre para una terapia de 1 paciente, y al elegirlo el guardado lo
   * rechazaba con "el terapeuta ya tiene el cupo completo".
   *
   * `excluirCitaId` saca una cita del conteo: al mover una cita, la que se mueve no debe
   * estorbarse a si misma.
   */
  getDia(terapeutaId: number, fecha: string,
         opciones: { cupo?: number | null; excluirCitaId?: number | string | null } = {}): Observable<DisponibilidadDia> {
    return this.api.get<DisponibilidadDia>(
      `/api/terapeutas/${terapeutaId}/disponibilidad`,
      {
        fecha,
        cupo: opciones.cupo != null ? String(opciones.cupo) : undefined,
        excluirCitaId: opciones.excluirCitaId != null ? String(opciones.excluirCitaId) : undefined,
      }
    );
  }

  getSemana(terapeutaId: number, desde: string, hasta: string): Observable<DisponibilidadDia[]> {
    return this.api.get<DisponibilidadDia[]>(
      `/api/terapeutas/${terapeutaId}/disponibilidad/semana`,
      { desde, hasta }
    );
  }

  /**
   * La semana de TODOS los terapeutas en una sola peticion.
   *
   * El modal de citas necesita saber quien esta disponible, y pedirlo terapeuta por terapeuta
   * significaba una peticion HTTP por cada uno — multiplicada por cada campo que se tocara en
   * el formulario. Devuelve {terapeutaId: dias}.
   */
  getSemanaDeTodos(desde: string, hasta: string): Observable<Record<number, DisponibilidadDia[]>> {
    return this.api.get<Record<number, DisponibilidadDia[]>>(
      '/api/disponibilidad/semana',
      { desde, hasta }
    );
  }
}
