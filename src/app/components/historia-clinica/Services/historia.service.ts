import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { HcPlantilla, HistoriaClinica } from '../Models/historia.model';

@Injectable({ providedIn: 'root' })
export class HistoriaClinicaService {
  private readonly PLANTILLAS = '/api/hc-plantillas';
  private readonly HISTORIAS = '/api/historias-clinicas';

  constructor(private api: ApiService) {}

  /** Sin `todas` devuelve solo las plantillas activas — es lo que necesita la ficha. */
  getPlantillas(todas = false): Observable<HcPlantilla[]> {
    return this.api.get<HcPlantilla[]>(this.PLANTILLAS, todas ? { todas: 'true' } : {});
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
