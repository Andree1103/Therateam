/**
 * Como se escriben las fechas de una cita en pantalla.
 *
 * Va en un solo sitio porque antes cada pantalla lo resolvia por su cuenta —una con el pipe de
 * Angular, dos con toLocaleDateString y cada una con sus opciones— y la misma cita se leia
 * distinta segun donde la mirases.
 *
 * Llevan el dia de la semana en letras a peticion del negocio, y tiene sentido: quien agenda
 * piensa en "el martes", no en "el 14". Sin el, para saber que dia caia una cita habia que
 * contar en un calendario.
 *
 * El dia se pega por delante en vez de pedirselo a toLocaleDateString junto al resto. Parece un
 * rodeo y no lo es: en cuanto se le añade `weekday`, el locale es-PE cambia al formato largo y
 * "26 oct. 2026" pasa a ser "26 de oct. de 2026". Componiendolo se conserva el formato corto
 * que ya se usaba y solo se gana el dia.
 */

const ZONA = 'es-PE';

function valida(f?: string | Date | null): Date | null {
  if (!f) return null;
  const d = new Date(f);
  return isNaN(d.getTime()) ? null : d;
}

function dia(d: Date): string {
  return d.toLocaleDateString(ZONA, { weekday: 'long' });
}

/** "lunes, 26 oct. 2026, 03:00 p. m." — para tablas y fichas, donde el año importa. */
export function fechaHoraConDia(f?: string | Date | null): string {
  const d = valida(f);
  if (!d) return '—';
  return dia(d) + ', ' + d.toLocaleDateString(ZONA, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * "lunes, 26 oct., 03:00 p. m." — para desplegables y listas de opciones.
 *
 * Sin año a proposito: ahi solo salen citas pendientes, que son de estos dias, y la opcion ya
 * lleva terapia, terapeuta e importe. Un año repetido en cada linea solo estorba.
 */
export function fechaHoraCortaConDia(f?: string | Date | null): string {
  const d = valida(f);
  if (!d) return '—';
  return dia(d) + ', ' + d.toLocaleDateString(ZONA, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

/** "lunes, 26 oct. 2026" — sin hora. */
export function fechaConDia(f?: string | Date | null): string {
  const d = valida(f);
  if (!d) return '—';
  return dia(d) + ', ' + d.toLocaleDateString(ZONA, {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}
