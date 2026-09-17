

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

/** "09:00:00" -> "09:00". El back manda segundos que aquí no aportan nada. */
export function soloHoraYMinuto(hora?: string | null): string {
  return hora ? hora.slice(0, 5) : '';
}
