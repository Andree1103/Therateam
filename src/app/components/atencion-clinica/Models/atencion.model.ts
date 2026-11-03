export interface AtencionMetrica {
  id?: number;
  metrica: string;
  valor: number | null;
  unidad?: string;
  notas?: string;
}

export interface AtencionClinica {
  /** ATENDIDA = la sesion se dio; INASISTENCIA = el paciente no vino. */
  /**
   * Que paso con la cita. Tres respuestas, no dos: NO_MARCO es la cita que ya paso y a la que
   * nadie le dijo si el paciente vino o no. Es el valor por defecto a proposito — hasta que
   * alguien diga que paso, lo que paso es que no se marco.
   */
  tipo?: 'ATENDIDA' | 'INASISTENCIA' | 'NO_MARCO';
  /** Por que no vino (INASISTENCIA) o por que se paso (NO_MARCO, opcional). */
  motivo?: string | null;
  id?: number;
  citaId: number;
  fechaInicioReal: string;
  fechaFinReal?: string;
  duracionRealMin?: number;
  notasPost?: string;
  archivosUrl?: string[];
  metricas?: AtencionMetrica[];
  createdAt?: string;
  updatedAt?: string;
}

export const METRICAS_DEFAULT: Omit<AtencionMetrica, 'id'>[] = [
  { metrica: 'Dolor',      valor: null, unidad: '/10'  },
  { metrica: 'Movilidad',  valor: null, unidad: '/10'  },
  { metrica: 'Fuerza',     valor: null, unidad: '/10'  },
];
