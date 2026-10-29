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
export type EstadoPagoKey =
  'SIN_PAGO' | 'PARCIAL' | 'PAGADA' | 'DESCONTADA' | 'DEVUELTO' | 'A_FAVOR';

/**
 * La cita se anuló y su dinero ya tiene destino: se devolvió, o quedó a favor del paciente.
 *
 * Son dos finales, no dos formas de "sin pago". Mientras compartieron estado, el listado no
 * podía decir cuál de los dos había sido y había que entrar a Pagos a buscar si existía una
 * devolución.
 */
export function yaSeResolvio(key?: string | null): boolean {
  return key === 'DEVUELTO' || key === 'A_FAVOR';
}

/** La cita no tiene nada pendiente de cobro: se pagó, se descontó, o ya se resolvió al anularla. */
export function estaSaldada(key?: string | null): boolean {
  return key === 'PAGADA' || key === 'DESCONTADA' || yaSeResolvio(key);
}

/** Queda plata por cobrar en esta cita. */
export function tieneDeuda(key?: string | null): boolean {
  return !estaSaldada(key);
}

/**
 * Hay dinero aplicado AHORA mismo en la cita, así que anularla obliga a decidir qué pasa con él.
 *
 * No es lo contrario de SIN_PAGO, que es como se escribía antes: una cita ya devuelta tampoco
 * tiene dinero encima, y preguntar otra vez qué hacer con él ofrecería devolver dos veces lo
 * mismo.
 */
export function tieneDineroAplicado(key?: string | null): boolean {
  return key === 'PAGADA' || key === 'PARCIAL' || key === 'DESCONTADA';
}

/** Color del chip cuando no viene del catálogo del backend. */
export function colorEstadoPago(key?: string | null): string {
  if (key === 'PAGADA')     return '#22c55e';
  if (key === 'DESCONTADA') return '#d97706';
  if (key === 'PARCIAL')    return '#f59e0b';
  if (key === 'DEVUELTO')   return '#0ea5e9';
  if (key === 'A_FAVOR')    return '#8b5cf6';
  return '#94a3b8'; // SIN_PAGO
}
