/**
 * El estado de la CITA, que es distinto del estado de su pago.
 *
 * Son dos preguntas independientes y confundirlas tiene consecuencias. Una cita anulada sigue
 * teniendo su estado de pago en SIN_PAGO —nadie la pago nunca— asi que mirar solo el pago la
 * da por cobrable. Eso se veia en el desplegable de "Registrar pago": aparecian citas anuladas
 * y de inasistencia invitando a cobrarlas, cuando esas ya no se cobran.
 */

/** Estados en los que la cita ya no da lugar a un cobro nuevo. */
const YA_NO_SE_COBRA = ['ANULADA', 'NO_ASISTIO', 'REPROGRAMADA'];

/**
 * Si todavia tiene sentido cobrar esta cita.
 *
 * NO_ASISTIO entra en las que no: lo que se hace con el dinero de una inasistencia se decide
 * al registrarla —se descuenta o se devuelve— no cobrandola despues desde Pagos.
 *
 * REPROGRAMADA tampoco: su dinero y su sesion se fueron a la cita nueva, y la vieja solo queda
 * como rastro. Cobrarla seria cobrar dos veces la misma sesion.
 */
export function sePuedeCobrar(estadoKey?: string | null): boolean {
  return !YA_NO_SE_COBRA.includes((estadoKey ?? '').trim().toUpperCase());
}
