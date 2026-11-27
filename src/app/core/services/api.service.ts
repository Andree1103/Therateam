import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map, mergeMap, switchMap, toArray } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | undefined>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v != null) httpParams = httpParams.set(k, v); });
    }
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams });
  }

  /**
   * Trae TODAS las filas de un listado paginado, pidiendo las páginas que haga falta.
   *
   * Existe porque pedir `size=1000` (o 2000, o 10000) no es traer todo: es traer la primera
   * página y tirar el resto sin avisar. Así salía el Excel de citas de un trimestre — el
   * servidor contestaba `totalElements: 3278`, la pantalla se quedaba con las 2000 de la
   * primera página, y como las que faltaban estaban repartidas por todo el rango el archivo
   * parecía completo: aparecían 22 citas del 27 de noviembre de las 84 que había, y nada
   * decía que faltaran 62. Exportar un solo día sí salía bien, porque un día entra en una
   * página; es lo que hacía que el fallo pareciera cosa del rango.
   *
   * Subir el número no lo arregla: el servidor tiene su propio tope (MAX_PAGE_SIZE, hoy
   * 10.000) y por encima de eso recorta igual, calladamente. Mientras el número lo ponga
   * quien llama, el error vuelve en cuanto la clínica crezca — hoy ya hay 7.579 pacientes
   * contra un tope de 10.000. La única forma de no equivocarse con el número es no elegirlo:
   * se lee `totalPages` y se piden todas.
   *
   * El orden lo fija esta función, siempre por `id`, y por eso no acepta `sort`: pedir dos
   * páginas de una consulta sin ORDER BY no garantiza que la segunda siga donde acabó la
   * primera —Postgres puede repetir una fila y saltarse otra—, y el `/filtro` de citas venía
   * justo así, sin orden. Quien pinta la lista la ordena como quiera después, con todo ya en
   * la mano; el Excel de citas, por ejemplo, ordena por fecha al armar las filas.
   */
  getTodo<T>(path: string, params: Record<string, string | undefined> = {},
             porPagina = 1000): Observable<T[]> {
    const pagina = (n: number) => this.get<PageResponse<T> | T[]>(
      path, { ...params, page: String(n), size: String(porPagina), sort: 'id,asc' });

    return pagina(0).pipe(switchMap(primera => {
      // Algunos endpoints devuelven la lista pelada, sin envoltorio de página: ahí ya está todo.
      if (Array.isArray(primera)) return of(primera);
      const paginas = primera.totalPages ?? 1;
      if (paginas <= 1) return of(primera.content);

      const siguientes: number[] = [];
      for (let n = 1; n < paginas; n++) siguientes.push(n);
      // De cuatro en cuatro, no todas de golpe: un rango de dos años son decenas de páginas y
      // lanzarlas a la vez es una tromba contra el servidor por un Excel que nadie urge.
      return from(siguientes).pipe(
        mergeMap(n => pagina(n).pipe(
          map(r => ({ n, filas: Array.isArray(r) ? r : r.content }))), 4),
        toArray(),
        // Vuelven en el orden en que contesten, no en el que se pidieron: se recolocan por
        // número de página para que la lista salga igual que si se hubiera pedido de una vez.
        map(trozos => trozos.sort((a, b) => a.n - b.n)
          .reduce<T[]>((acc, t) => acc.concat(t.filas), primera.content)),
      );
    }));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  patch<T>(path: string, body: unknown, params?: Record<string, string | undefined>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v != null) httpParams = httpParams.set(k, v); });
    }
    return this.http.patch<T>(`${this.base}${path}`, body, { params: httpParams });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`);
  }
}
