export interface CatalogItem {
  id: number;
  key?: string;
  nombre: string;
  activo?: boolean;
  colorHex?: string;
  codigo?: string;
  simbolo?: string;
  duracionMinutos?: number;
  maxPacientes?: number;
}

export interface Sede {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  activo?: boolean;
}
