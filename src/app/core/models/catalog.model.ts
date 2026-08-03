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
  area?: { id: number; nombre?: string; key?: string } | null;
  especialidad?: { id: number; nombre?: string; key?: string } | null;
  sesionesSugeridas?: number | null;
  comentario?: string | null;
  precioRecomendado?: number | null;
  // Plantillas de paquete (catálogo)
  categoria?: string | null;
  tipoTerapia?: { id: number; nombre?: string; key?: string; area?: { id: number; nombre?: string } | null } | null;
  totalSesiones?: number | null;
  precioTotal?: number | null;
}

export interface Sede {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  activo?: boolean;
}
