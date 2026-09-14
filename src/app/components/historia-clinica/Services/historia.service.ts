import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { HcPlantilla, HistoriaClinica, TipoFicha } from '../Models/historia.model';

@Injectable({ providedIn: 'root' })
export class HistoriaClinicaService {
  private readonly PLANTILLAS = '/api/hc-plantillas';
  private readonly HISTORIAS = '/api/historias-clinicas';

  constructor(private api: ApiService) {}

  /**
   * Plantillas de un tipo de ficha. Sin `todas` devuelve solo las activas, que es lo que
   * necesitan las pantallas donde se llena la ficha; `todas` lo usa la que las administra.
   */
  getPlantillas(tipo?: TipoFicha, todas = false): Observable<HcPlantilla[]> {
    return this.api.get<HcPlantilla[]>(this.PLANTILLAS, {
      tipo: tipo ?? undefined,
      todas: todas ? 'true' : undefined,
    });
  }

  /**
   * La plantilla que corresponde a un tipo de terapia: la suya si la tiene, si no la genérica.
   * Devuelve null (204) si no hay ninguna activa de ese tipo de ficha.
   */
  resolver(tipo: TipoFicha, tipoTerapiaId?: number | null): Observable<HcPlantilla | null> {
    return this.api.get<HcPlantilla | null>(`${this.PLANTILLAS}/resolver`, {
      tipo,
      tipoTerapiaId: tipoTerapiaId != null ? String(tipoTerapiaId) : undefined,
    });
  }

  getPlantilla(id: number): Observable<HcPlantilla> {
    return this.api.get<HcPlantilla>(`${this.PLANTILLAS}/${id}`);
  }

  crearPlantilla(data: HcPlantilla): Observable<HcPlantilla> {
    return this.api.post<HcPlantilla>(this.PLANTILLAS, data);
  }

  actualizarPlantilla(id: number, data: HcPlantilla): Observable<HcPlantilla> {
    return this.api.put<HcPlantilla>(`${this.PLANTILLAS}/${id}`, data);
  }

  /** El backend desactiva en vez de borrar si la plantilla ya tiene fichas cargadas. */
  eliminarPlantilla(id: number): Observable<{ resultado: string }> {
    return this.api.delete<{ resultado: string }>(`${this.PLANTILLAS}/${id}`);
  }

  getHistorias(pacienteId: number): Observable<HistoriaClinica[]> {
    return this.api.get<HistoriaClinica[]>(this.HISTORIAS, { pacienteId: String(pacienteId) });
  }

  /** Upsert: crea la ficha la primera vez y la actualiza después. */
  guardar(pacienteId: number, plantillaId: number, datos: Record<string, unknown>): Observable<HistoriaClinica> {
    return this.api.put<HistoriaClinica>(
      `${this.HISTORIAS}/paciente/${pacienteId}/plantilla/${plantillaId}`, datos);
  }
}
