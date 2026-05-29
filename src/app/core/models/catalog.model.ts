export interface CatalogItem {
  id: number;
  key?: string;
  nombre: string;
  activo?: boolean;
  colorHex?: string;
}

export interface Sede {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  activo?: boolean;
}
