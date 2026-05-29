import { Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Terapeuta, TerapeutaCompletoRequest, terapeutaNombre, UsuarioBasico } from '../Models/terapeuta.model';

@Injectable({ providedIn: 'root' })
export class TerapeutaService {
  private readonly PATH = '/api/terapeutas';

  constructor(private api: ApiService) {}

  getAll(): Observable<Terapeuta[]> {
    return this.api.get<Terapeuta[]>(this.PATH);
  }

  getById(id: number): Observable<Terapeuta> {
    return this.api.get<Terapeuta>(`${this.PATH}/${id}`);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }

  createCompleto(body: TerapeutaCompletoRequest): Observable<Terapeuta> {
    return this.api.post<Terapeuta>(`${this.PATH}/completo`, body);
  }

  updateCompleto(id: number, body: TerapeutaCompletoRequest): Observable<Terapeuta> {
    return this.api.put<Terapeuta>(`${this.PATH}/${id}/completo`, body);
  }

  getUsuariosLibres(): Observable<UsuarioBasico[]> {
    return this.api.get<UsuarioBasico[]>('/api/usuarios/libres').pipe(catchError(() => of([])));
  }

  getParaDropdown(): Observable<{ id: number; nombre: string }[]> {
    return this.getAll().pipe(
      map(list => list.map(t => ({ id: t.id!, nombre: terapeutaNombre(t) })))
    );
  }
}
