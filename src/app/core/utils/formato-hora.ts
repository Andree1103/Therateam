/**
 * Un único formato de hora para todo lo que se exporta: `08:00 a. m.`
 *
 * POR QUÉ AQUÍ Y NO EN CADA PANTALLA: cada exportación resolvía la hora por su cuenta. Las que
 * partían de una fecha usaban toLocaleTimeString con es-PE y salían en 12 h con a. m./p. m.; las
 * de horarios fijos recortaban el texto que manda el back ("08:00:00" → "08:00") y salían en
 * 24 h. Dos archivos de la misma clínica, dos formatos, y nadie podía cruzarlos sin traducir
 * mentalmente. Con una sola función el formato es uno y cambiarlo es cambiar un archivo.
 *
 * Acepta las dos formas en que llega una hora en este sistema:
 *   - fecha completa (Date o ISO) — las citas, las atenciones, los pagos;
 *   - texto "HH:mm" o "HH:mm:ss" — los horarios fijos y los bloques de terapeuta, que no tienen día.
 */

/** Hora local en 12 h con a. m./p. m. Cadena vacía si no hay dato, para no escribir "Invalid Date". */
export function horaAmPm(valor?: string | Date | null): string {
  const d = aFecha(valor);
  if (!d) return '';
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Fecha y hora juntas: `22/09/2026 08:05 a. m.` Sin segundos, que en un Excel solo estorban. */
export function fechaHoraAmPm(valor?: string | Date | null): string {
  const d = aFecha(valor);
  if (!d) return '';
  return `${d.toLocaleDateString('es-PE')} ${horaAmPm(d)}`;
}

/** Rango de una cita o de un bloque: `08:00 a. m. – 09:00 a. m.` */
export function rangoHoraAmPm(desde?: string | Date | null, hasta?: string | Date | null): string {
  const a = horaAmPm(desde);
  const b = horaAmPm(hasta);
  if (!a) return '';
  return b ? `${a} – ${b}` : a;
}

/**
 * Un "HH:mm[:ss]" suelto no es una fecha, así que se apoya en un día cualquiera para poder
 * formatearlo. El día da igual: solo se imprime la hora.
 */
function aFecha(valor?: string | Date | null): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;

  const texto = String(valor).trim();
  if (!texto) return null;

  const soloHora = /^(\d{1,2}):(\d{2})(:(\d{2}))?$/.exec(texto);
  if (soloHora) {
    const d = new Date(2000, 0, 1, Number(soloHora[1]), Number(soloHora[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(texto);
  return isNaN(d.getTime()) ? null : d;
}
