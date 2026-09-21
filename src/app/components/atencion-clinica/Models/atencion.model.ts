export interface AtencionMetrica {
  id?: number;
  metrica: string;
  valor: number | null;
  unidad?: string;
  notas?: string;
}

export interface AtencionClinica {
  /** ATENDIDA = la sesion se dio; INASISTENCIA = el paciente no vino. */
  tipo?: 'ATENDIDA' | 'INASISTENCIA';
  /** Por que no vino. Solo con valor cuando tipo es INASISTENCIA. */
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
