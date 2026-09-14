export interface AtencionMetrica {
  id?: number;
  metrica: string;
  valor: number | null;
  unidad?: string;
  notas?: string;
}

export interface AtencionClinica {
  id?: number;
  citaId: number;
  fechaInicioReal: string;
  fechaFinReal?: string;
  duracionRealMin?: number;
  /** Observacion libre. Convive con el SOAP: es lo que cargaron las atenciones anteriores. */
  notasPost?: string;

  // ── SOAP: el formato con el que se documenta una atencion clinica ──
  /** Lo que refiere el paciente. */
  subjetivo?: string;
  /** Lo que el terapeuta observa y mide. */
  objetivo?: string;
  /** La interpretacion clinica. */
  analisis?: string;
  /** Que sigue para la proxima sesion. */
  plan?: string;
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
