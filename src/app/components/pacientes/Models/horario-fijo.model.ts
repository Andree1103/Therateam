import { rangoHoraAmPm } from '../../../core/utils/formato-hora';


/**
 * El horario habitual de un paciente: "viene los lunes a las 9 con Carla, terapia KIDS".
 *
 * Es solo referencia. No reserva el espacio en la agenda ni genera citas — agendar sigue siendo
 * manual. Sirve para saber de un vistazo si el paciente tiene horarios fijos, en qué terapias
 * y con qué terapeutas.
 */
export interface HorarioFijo {
  id?: number;
  paciente_id?: number;
  terapeuta?: { id: number; nombre?: string; apellido?: string; [k: string]: any };
  tipoTerapia?: { id: number; nombre?: string; key?: string } | null;
  /** 1 = lunes … 7 = domingo. */
  diaSemana: number;
  /** "09:00" o "09:00:00" — el back manda LocalTime. */
  horaInicio: string;
  horaFin?: string | null;
  activo?: boolean;
  notas?: string | null;
}

/** Lo que se manda al guardar: solo ids, sin entidades anidadas. */
export interface HorarioFijoRequest {
  terapeutaId: number;
  tipoTerapiaId?: number | null;
  diaSemana: number;
  horaInicio: string;
  horaFin?: string | null;
  notas?: string | null;
}

/** Índice 0 sin usar para que DIAS_SEMANA[1] sea lunes, igual que en la base. */
export const DIAS_SEMANA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Abreviatura de dos letras para las pastillas del selector.
 * Con una sola letra, "M" vale para martes y miércoles, y "Lunes/Martes/Miércoles" quedaba como
 * "L M M": imposible saber cuál se marcó sin pasar el mouse por encima.
 */
export const DIAS_CORTOS = ['', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/**
 * Nombre del terapeuta del horario.
 *
 * El DTO trae la entidad Terapeuta completa y el nombre vive en su `usuario`, no en la raíz —
 * leerlo de `terapeuta.nombre` devolvía vacío en silencio. Se resuelve una vez aquí para que
 * ninguna pantalla tenga que recordarlo.
 */
export function nombreTerapeutaDeHorario(h: HorarioFijo): string {
  const t: any = h.terapeuta;
  if (!t) return '';
  return `${t.usuario?.nombre ?? t.nombre ?? ''} ${t.usuario?.apellido ?? t.apellido ?? ''}`.trim();
}

/** "09:00:00" -> "09:00". El back manda segundos que aquí no aportan nada. */
export function soloHoraYMinuto(hora?: string | null): string {
  return hora ? hora.slice(0, 5) : '';
}

/**
 * Una línea de horario fijo vista desde fuera de la ficha: incluye de quién es.
 *
 * El listado por paciente omite al paciente a propósito —desde su ficha ya se sabe—, pero en
 * la vista general esa es justo la columna que hace falta, así que el back manda otra forma.
 */
export interface HorarioFijoResumen {
  id: number;
  pacienteId: number;
  paciente: string;
  dni?: string | null;
  sede?: string | null;
  terapeutaId?: number | null;
  terapeuta?: string | null;
  tipoTerapiaId?: number | null;
  tipoTerapia?: string | null;
  /** 1 = lunes … 7 = domingo. */
  diaSemana: number;
  horaInicio: string;
  horaFin?: string | null;
  notas?: string | null;
}

/**
 * "Lu 09:00 a. m. – 09:45 a. m. · Ana Quispe · KIDS" — una línea legible para resumir en una celda.
 *
 * Solo la usa la exportación de pacientes, y va en am/pm como el resto de los archivos: antes
 * esta columna salía en 24 h mientras la hoja de al lado, la de citas, salía en 12 h.
 */
export function resumirHorarioFijo(h: HorarioFijoResumen): string {
  const rango = rangoHoraAmPm(h.horaInicio, h.horaFin);
  return [`${DIAS_CORTOS[h.diaSemana]} ${rango}`, h.terapeuta || null, h.tipoTerapia || null]
    .filter(Boolean).join(' · ');
}

/** Minutos entre inicio y fin, cuando quedó anotada la hora de fin. */
export function duracionHorarioFijo(h: { horaInicio: string; horaFin?: string | null }): number | null {
  if (!h.horaFin) return null;
  const min = (t: string) => { const [hh, mm] = t.split(':'); return (+hh) * 60 + (+mm); };
  const d = min(h.horaFin) - min(h.horaInicio);
  return d > 0 ? d : null;
}
