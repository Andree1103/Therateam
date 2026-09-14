/** Tipos de campo que admite una plantilla. Debe coincidir con HcCampo.TIPOS del backend. */
export type TipoCampoHc =
  | 'TEXTO'
  | 'TEXTO_LARGO'
  | 'NUMERO'
  | 'FECHA'
  | 'BOOLEANO'
  | 'SELECT'
  | 'MULTISELECT';

export interface HcCampo {
  id?: number;
  /** Llave con la que se guarda el valor. No cambia aunque se renombre la etiqueta. */
  clave: string;
  etiqueta: string;
  tipo: TipoCampoHc;
  /** Solo para SELECT y MULTISELECT. */
  opciones?: string[] | null;
  requerido?: boolean;
  ayuda?: string | null;
  orden?: number;
}

export interface HcSeccion {
  id?: number;
  nombre: string;
  orden?: number;
  campos: HcCampo[];
}

/** Para qué ficha sirve la plantilla. */
export type TipoFicha = 'HISTORIA' | 'ATENCION';

export interface HcPlantilla {
  id?: number;
  nombre: string;
  tipo: TipoFicha;
  /**
   * Tipo de terapia al que aplica. Null = genérica, sirve para cualquiera.
   * Se ata al tipo de terapia (no al área) porque es lo que lleva la cita: así la plantilla
   * de una atención se resuelve sola, y porque el área es demasiado gruesa — una Evaluación
   * Psicológica y una Terapia de Lenguaje son las dos de Kids y no preguntan lo mismo.
   */
  tipoTerapia?: { id: number; nombre?: string } | null;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number;
  secciones: HcSeccion[];
}

export interface HistoriaClinica {
  id?: number;
  pacienteId?: number;
  plantilla: HcPlantilla;
  /** {claveDelCampo: valor} — la plantilla dice qué claves son válidas. */
  datos: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export const ETIQUETA_TIPO: Record<TipoCampoHc, string> = {
  TEXTO: 'Texto corto',
  TEXTO_LARGO: 'Texto largo',
  NUMERO: 'Número',
  FECHA: 'Fecha',
  BOOLEANO: 'Sí / No',
  SELECT: 'Lista (una opción)',
  MULTISELECT: 'Lista (varias opciones)',
};
