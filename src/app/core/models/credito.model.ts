/**
 * El crédito de la clínica: atenciones dadas hoy que paga alguien a fin de mes.
 *
 * El caso que lo motivó es el terapeuta que trae a su madre y paga cuando le pagan. Lo que
 * faltaba no era un campo "debe" en la cita, era saber QUIÉN responde por esa deuda — por eso
 * la cuenta cuelga de un usuario y no de un paciente: el titular es quien tiene sueldo del que
 * descontar, y un paciente puede no tener ni cuenta de acceso.
 */

/** A quién se le fía. Cambia solo cómo se agrupa el reporte de cobranza, no las reglas. */
export type TipoCuentaCredito = 'TRABAJADOR' | 'PACIENTE' | 'CONVENIO';

export interface CuentaCredito {
  id: number;
  titularUsuarioId: number;
  titularNombre: string;
  titularEmail?: string | null;
  titularRol?: string | null;
  titularTerapeutaId?: number | null;

  tipo: TipoCuentaCredito;
  /** Tope de deuda. null es sin tope — se avisa, nunca se bloquea una atención por esto. */
  limite?: number | null;
  activo?: boolean;
  notas?: string | null;

  /**
   * Lo que debe hoy. No hay saldo guardado en ninguna tabla: se suma de sus citas y sus
   * paquetes cada vez que se pregunta, porque un contador que se desincroniza miente con cara
   * de dato (ya pasó con los saldos de los pacientes).
   */
  deuda: number;
  deudaEnCitas: number;
  deudaEnPaquetes: number;

  citas: number;
  paquetes: number;
  pacientes: number;

  /** La atención más vieja sin cobrar. Es la antigüedad real de la deuda. */
  desde?: string | null;
  sePasaDelLimite?: boolean;
}

/**
 * Una atención sin cobrar de la cuenta: una cita suelta o un paquete entero.
 *
 * Son las dos formas que puede tomar, y no se mezclan por capricho: el crédito de un paquete
 * vive en el paquete y no en sus citas, porque el dinero del paquete está ahí (montoTotal
 * contra totalCobrado) y ponerlo en los dos extremos contaría la deuda dos veces.
 */
export interface CreditoLinea {
  tipo: 'CITA' | 'PAQUETE';
  id: number;
  fecha?: string | null;
  pacienteId?: number | null;
  pacienteNombre?: string | null;
  terapeutaNombre?: string | null;
  descripcion?: string | null;
  estado?: string | null;
  estadoPago?: string | null;
  monto: number;
  pagado: number;
  deuda: number;
}

/** Un paciente cubierto por la cuenta. `activo` en false es un amarre que ya no vale, no un borrado. */
export interface CreditoAmarre {
  id: number;
  pacienteId: number;
  pacienteNombre: string;
  pacienteDni?: string | null;
  activo?: boolean;
  desde?: string | null;
}

export interface CobroCreditoRequest {
  metodoId: number | null;
  /** Qué líneas se cobran. Si no va, se cobra todo lo pendiente. */
  lineas?: { tipo: string; id: number }[];
  /** Cuánto. Si no va, la deuda completa de esas líneas. */
  monto?: number | null;
  referencia?: string | null;
  notas?: string | null;
}

export interface CobroCredito {
  cuentaId: number;
  titularNombre: string;
  metodoNombre: string;
  /** false con el descuento de planilla: el cobro queda registrado pero no entró plata al cajón. */
  entroACaja: boolean;
  cobrado: number;
  deudaRestante: number;
  lineasSaldadas: number;
  lineasTocadas: number;
  referencia: string;
  pagoIds: number[];
  detalle: CreditoLinea[];
}
