export interface IngresoMetodo {
  metodoId: number | null;
  metodoNombre: string;
  monto: number;
}

export interface CajaResumen {
  fecha: string;
  saldoInicial: number;
  ingresosPorMetodo: IngresoMetodo[];
  totalIngresos: number;
  egresos: number;
  comentario: string | null;
  saldoFinal: number;
  cerrado: boolean;
  cerradoPorNombre: string | null;
}

export interface CerrarCajaRequest {
  fecha: string;
  egresos: number;
  comentario: string;
}

export interface CierreCaja {
  id: number;
  fecha: string;
  saldoInicial: number;
  totalIngresos: number;
  egresos: number;
  saldoFinal: number;
  comentario: string | null;
}
