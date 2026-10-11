/**
 * El estado de la CITA, que es distinto del estado de su pago.
 *
 * Son dos preguntas independientes y confundirlas tiene consecuencias. Una cita anulada sigue
 * teniendo su estado de pago en SIN_PAGO —nadie la pago nunca— asi que mirar solo el pago la
 * da por cobrable. Eso se veia en el desplegable de "Registrar pago": aparecian citas anuladas
 * y de inasistencia invitando a cobrarlas, cuando esas ya no se cobran.
 */

/**
 * Estados en los que la cita ya no da lugar a un cobro nuevo.
 *
 * Son SEIS, no tres. La primera version listaba ANULADA, NO_ASISTIO y REPROGRAMADA, y se colaban
 * las canceladas por paciente o por clinica y las dos variantes viejas de inasistencia. Hoy el
 * sistema solo escribe ANULADA y NO_ASISTIO —el porque va como texto en la cita— pero las otras
 * cuatro siguen en el catalogo desactivadas, y basta una fila sin migrar para que una cita
 * cancelada vuelva a ofrecerse para cobrar.
 *
 * ASISTIDA NO esta, a proposito: una sesion que se dio y no se pago es una deuda legitima y
 * tiene que poder cobrarse. Para meter citas en un paquete la regla es otra —ahi ASISTIDA si
 * queda fuera— y por eso el backend tiene dos listas (EstadosDeCita.NO_SE_COBRAN y
 * YA_NO_ES_UNA_SESION_POR_DAR) en vez de una.
 */
const YA_NO_SE_COBRA = [
  'ANULADA', 'CANCELADA_PACIENTE', 'CANCELADA_CLINICA',
  'NO_ASISTIO', 'INASISTENCIA', 'INASISTENCIA SIN',
  'REPROGRAMADA',
];

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
