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

  cerrar(req: CerrarCajaRequest): Observable<CajaResumen> {
    return this.api.post<CajaResumen>(`${this.PATH}/cerrar`, req);
  }

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
