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
}
