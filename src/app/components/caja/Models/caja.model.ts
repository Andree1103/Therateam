export interface IngresoMetodo {
  metodoId: number | null;
  metodoNombre: string;
  monto: number;
}

export interface CajaResumen {
  fecha: string;
  turno: number;
  /** Hora (HH:mm) configurada que separa el turno 1 del turno 2. */
  horaCorte: string;
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
