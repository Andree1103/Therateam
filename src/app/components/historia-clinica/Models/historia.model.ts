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

export interface HcPlantilla {
  id?: number;
  nombre: string;
  area?: { id: number; nombre?: string } | null;
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
