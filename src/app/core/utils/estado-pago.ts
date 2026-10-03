/**
 * Estados de pago de una cita, y la pregunta que de verdad se hace la pantalla.
 *
 * Durante mucho tiempo "no debe nada" se escribio como `estado_pago_key === 'PAGADA'`, porque
 * no habia mas. Con DESCONTADA —el paciente no vino y la clinica se quedo con lo cobrado— esa
 * forma pasa a ser falsa: la cita no esta PAGADA y sin embargo no hay nada que cobrarle. Si se
 * deja como estaba, esas citas reaparecen en el buscador de Pagos como deuda, en el total que
 * debe el paciente, y con un boton "Registrar pago" invitando a cobrar dos veces lo mismo.
 *
 * Por eso la pregunta se nombra: SALDADA es "no se le debe cobrar mas", que no es lo mismo que
 * "se pago la sesion". Donde la pantalla si quiere decir literalmente PAGADA —registrar la
 * atencion exige una sesion pagada de verdad, y una inasistencia no se atiende— se sigue
 * comparando con PAGADA a mano, a proposito.
 */
export type EstadoPagoKey = 'SIN_PAGO' | 'PARCIAL' | 'PAGADA' | 'DESCONTADA';

/** La cita no tiene nada pendiente de cobro: o se pago, o se descontó por inasistencia. */
export function estaSaldada(key?: string | null): boolean {
  return key === 'PAGADA' || key === 'DESCONTADA';
}

/** Queda plata por cobrar en esta cita. */
export function tieneDeuda(key?: string | null): boolean {
  return !estaSaldada(key);
}

/** Color del chip cuando no viene del catálogo del backend. */
export function colorEstadoPago(key?: string | null): string {
  if (key === 'PAGADA')     return '#22c55e';
  if (key === 'DESCONTADA') return '#d97706';
  if (key === 'PARCIAL')    return '#f59e0b';
  return '#94a3b8'; // SIN_PAGO
}
