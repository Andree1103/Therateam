import { HcPlantilla } from '../../historia-clinica/Models/historia.model';

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

  // ── Ficha configurable (reemplaza al SOAP cuando hay plantilla de atencion) ──
  /** La plantilla con la que se registro: dice que etiqueta lleva cada valor de `datos`. */
  plantilla?: HcPlantilla | null;
  /** {claveDelCampo: valor} — se lee junto a la plantilla, ver resumenFicha(). */
  datos?: Record<string, unknown>;
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

/**
 * Convierte {clave: valor} en pares legibles usando la plantilla, que es la que sabe la
 * etiqueta y el orden de cada campo. Sin esto los valores de la ficha configurable no se
 * pueden mostrar en ningun listado: en la base son solo claves tecnicas.
 */
export function camposDeLaFicha(a: AtencionClinica): { etiqueta: string; valor: string }[] {
  const datos = a.datos ?? {};
  const secciones = a.plantilla?.secciones ?? [];
  const pares: { etiqueta: string; valor: string }[] = [];
  secciones.forEach(sec => sec.campos.forEach(c => {
    const v = datos[c.clave];
    if (v === null || v === undefined || v === '') return;
    const texto = Array.isArray(v) ? v.join(', ')
                : typeof v === 'boolean' ? (v ? 'Sí' : 'No')
                : String(v);
    if (texto.trim()) pares.push({ etiqueta: c.etiqueta, valor: texto });
  }));
  return pares;
}

/** Una linea con todo lo que tenga la atencion — para celdas de tabla y exportaciones. */
export function resumenAtencion(a: AtencionClinica): string {
  const deLaFicha = camposDeLaFicha(a).map(p => `${p.etiqueta}: ${p.valor}`);
  const soap = [
    a.subjetivo ? `S: ${a.subjetivo}` : '',
    a.objetivo  ? `O: ${a.objetivo}`  : '',
    a.analisis  ? `A: ${a.analisis}`  : '',
    a.plan      ? `P: ${a.plan}`      : '',
  ].filter(Boolean);
  return [...deLaFicha, ...soap, a.notasPost ?? ''].filter(x => x && x.trim()).join(' · ');
}
