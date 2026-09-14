import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** A que se adjunta el archivo. Debe coincidir con Archivo.ENTIDADES del backend. */
export type EntidadArchivo = 'ATENCION' | 'HISTORIA' | 'PACIENTE';

export interface Archivo {
  id: number;
  entidadTipo: EntidadArchivo;
  entidadId: number;
  nombreOriginal: string;
  nombreGuardado: string;
  mime: string;
  tamanoBytes: number;
  descripcion?: string | null;
  createdAt?: string;
  esImagen?: boolean;
}

/**
 * Adjuntos (fotos, informes, PDFs). El binario vive en el disco del servidor; aca solo se
 * manejan los metadatos y la descarga.
 *
 * La descarga NO puede ser un <img src> ni un <a href> directo: el endpoint exige el header
 * Authorization (lo pone authInterceptor), asi que se baja como blob y se convierte en object
 * URL (ver contenidoUrl).
 */
@Injectable({ providedIn: 'root' })
export class ArchivoService {
  private readonly base = `${environment.apiUrl}/api/archivos`;

  constructor(private http: HttpClient) {}

  listar(entidadTipo: EntidadArchivo, entidadId: number): Observable<Archivo[]> {
    return this.http.get<Archivo[]>(this.base, {
      params: { entidadTipo, entidadId: String(entidadId) },
    });
  }

  subir(entidadTipo: EntidadArchivo, entidadId: number, file: File, descripcion?: string): Observable<Archivo> {
    const form = new FormData();
    form.append('file', file, file.name);
    const params: Record<string, string> = { entidadTipo, entidadId: String(entidadId) };
    if (descripcion) params['descripcion'] = descripcion;
    return this.http.post<Archivo>(this.base, form, { params });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Object URL con el contenido ya descargado — sirve para <img src> y para abrir en pestaña. */
  contenidoUrl(id: number): Observable<string> {
    return this.http
      .get(`${this.base}/${id}/contenido`, { responseType: 'blob' })
      .pipe(map(blob => URL.createObjectURL(blob)));
  }

  maxMb(): Observable<number> {
    return this.http
      .get<{ maxMb: number }>(`${this.base}/limites`)
      .pipe(map(r => r.maxMb));
  }

  /** "1.4 MB", "820 KB" — para mostrar el peso sin que el usuario cuente ceros. */
  formatoTamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
