export interface IngresoMetodo {
  metodoId: number | null;
  metodoNombre: string;
  monto: number;
}

export interface IngresoConcepto {
  /** TERAPIAS | PRODUCTOS | OTROS — la clave estable; `nombre` es el texto a mostrar. */
  clave: string;
  nombre: string;
  monto: number;
}

/** Una fila del detalle de productos vendidos en el turno. */
export interface VentaProducto {
  productoId: number;
  nombreProducto: string;
  unidades: number;
  total: number;
}

export interface CajaResumen {
  fecha: string;
  turno: number;
  /** Hora (HH:mm) configurada que separa el turno 1 del turno 2. */
  horaCorte: string;
  saldoInicial: number;
  ingresosPorMetodo: IngresoMetodo[];
  /** El mismo dinero cortado por concepto: suma igual que ingresosPorMetodo. */
  ingresosPorConcepto: IngresoConcepto[];
  /** Qué productos se vendieron en el turno — detalle detrás de la fila "Productos". */
  ventasPorProducto: VentaProducto[];
  totalIngresos: number;
  egresos: number;
  comentario: string | null;
  saldoFinal: number;
  cerrado: boolean;
  cerradoPorNombre: string | null;
}

export interface CerrarCajaRequest {
  fecha: string;
  turno: number;
  egresos: number;
  comentario: string;
}

export interface CierreCaja {
  id: number;
  fecha: string;
  turno: number;
  saldoInicial: number;
  totalIngresos: number;
  egresos: number;
  saldoFinal: number;
  comentario: string | null;
  /** Quien registró/cerró este turno — mismo usuario de creación del cierre. */
  cerradoPor?: { nombre?: string; apellido?: string } | null;
}
