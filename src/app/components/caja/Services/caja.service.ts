import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CajaResumen, CerrarCajaRequest, CierreCaja } from '../Models/caja.model';

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly PATH = '/api/caja';

  constructor(private api: ApiService) {}

  getResumen(fecha: string, turno: number): Observable<CajaResumen> {
    return this.api.get<CajaResumen>(`${this.PATH}/resumen`, { fecha, turno: String(turno) });
  }

  /** Los dos turnos de cada dia del rango, saltandose los que no tuvieron movimiento. */
  getResumenRango(desde: string, hasta: string): Observable<CajaResumen[]> {
    return this.api.get<CajaResumen[]>(`${this.PATH}/resumen-rango`, { desde, hasta });
  }

  cerrar(req: CerrarCajaRequest): Observable<CajaResumen> {
    return this.api.post<CajaResumen>(`${this.PATH}/cerrar`, req);
  }

  /**
   * Los cierres GUARDADOS del rango — solo los turnos que alguien cuadro.
   *
   * La pantalla de caja ya no lo usa: lista turnos con movimiento (getResumenRango) para que un
   * turno cobrado y sin cerrar no desaparezca. Esto sigue aqui porque responde otra pregunta,
   * "que se cuadro", que es legitima; no es lo mismo que "que paso".
   */
  getHistorial(desde: string, hasta: string): Observable<CierreCaja[]> {
    return this.api.get<CierreCaja[]>(`${this.PATH}/historial`, { desde, hasta });
  }

  getHoraCorte(): Observable<{ horaCorte: string }> {
    return this.api.get<{ horaCorte: string }>(`${this.PATH}/hora-corte`);
  }

  actualizarHoraCorte(horaCorte: string): Observable<{ horaCorte: string }> {
    return this.api.put<{ horaCorte: string }>(`${this.PATH}/hora-corte`, { horaCorte });
  }
}
