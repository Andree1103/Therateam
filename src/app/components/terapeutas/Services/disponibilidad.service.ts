import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DisponibilidadDia } from '../Models/disponibilidad.model';

@Injectable({ providedIn: 'root' })
export class DisponibilidadService {
  constructor(private api: ApiService) {}

  getDia(terapeutaId: number, fecha: string): Observable<DisponibilidadDia> {
    return this.api.get<DisponibilidadDia>(
      `/api/terapeutas/${terapeutaId}/disponibilidad`,
      { fecha }
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
