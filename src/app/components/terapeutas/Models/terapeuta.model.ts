import { CatalogItem } from '../../../core/models/catalog.model';

export interface UsuarioBasico {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  sede?: { id: number; nombre?: string };
}

export interface Terapeuta {
  id?: number;
  usuario?: UsuarioBasico;
  // Campos planos que devuelve el DTO paginado
  nombre?: string;
  apellido?: string;
  email?: string;
  tipoTerapeuta?: CatalogItem;
  area?: CatalogItem;
  cmp?: string;
  telefono?: string;
  fotoUrl?: string;
  horarioDescripcion?: string;
  activo?: boolean;
  especialidades?: CatalogItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TerapeutaForm {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  sedeId: number | null;
  // datos del terapeuta
  areaId: number | null;
  cmp: string;
  telefono: string;
  horarioDescripcion: string;
  activo: boolean;
  especialidadIds: number[];
}

export interface TerapeutaCompletoRequest {
  modo: 'existente' | 'nuevo';
  usuarioId?: number;
  nombre?: string;
  apellido?: string;
  email?: string;
  password?: string;
  sedeId?: number | null;
  areaId?: number | null;
  cmp?: string;
  telefono?: string;
  horarioDescripcion?: string;
  activo: boolean;
  especialidadIds: number[];
}

export function terapeutaNombre(t: Terapeuta): string {
  // Prioridad: objeto usuario anidado → campos planos del DTO → fallback
  if (t.usuario?.nombre) return `${t.usuario.nombre} ${t.usuario.apellido ?? ''}`.trim();
  if (t.nombre)          return `${t.nombre} ${t.apellido ?? ''}`.trim();
  return `Terapeuta #${t.id}`;
}
