import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Producto, VentaItem, VentaResumen } from '../Models/producto.model';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly PATH = '/api/productos';

  constructor(private api: ApiService) {}

  getAll(): Observable<Producto[]> { return this.api.get<Producto[]>(this.PATH); }

  /** Solo los activos — es lo que se ofrece en el selector de venta. */
  getVendibles(): Observable<Producto[]> { return this.api.get<Producto[]>(`${this.PATH}/vendibles`); }

  create(p: Producto): Observable<Producto> { return this.api.post<Producto>(this.PATH, p); }

  update(id: number, p: Producto): Observable<Producto> { return this.api.put<Producto>(`${this.PATH}/${id}`, p); }

  /** Suma unidades al stock sin tocar precio ni nombre. */
  reponer(id: number, unidades: number): Observable<Producto> {
    return this.api.post<Producto>(`${this.PATH}/${id}/reponer?unidades=${unidades}`, {});
  }

  /** Desactiva; no borra — las ventas ya registradas apuntan al producto. */
  desactivar(id: number): Observable<void> { return this.api.delete<void>(`${this.PATH}/${id}`); }

  resumenVentas(desde?: string, hasta?: string): Observable<VentaResumen[]> {
    return this.api.get<VentaResumen[]>(`${this.PATH}/ventas/resumen`, { desde, hasta });
  }

  itemsDePago(pagoId: number): Observable<VentaItem[]> {
    return this.api.get<VentaItem[]>(`${this.PATH}/ventas/pago/${pagoId}`);
  }
}
