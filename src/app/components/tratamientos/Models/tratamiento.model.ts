import { CatalogItem } from '../../../core/models/catalog.model';

export interface Tratamiento {
  id?: number;
  paciente?: { id: number; nombre: string; apellido: string; };
  terapeuta?: { id: number; usuario?: { nombre: string; apellido: string; }; };
  tipoTerapia?: CatalogItem;
  estadoTratamiento?: CatalogItem;
  fechaInicio?: string;
  fechaFin?: string;
  sesionesTotal?: number;
  precioPorSesion?: number;
  notas?: string;
  activo?: boolean;
  createdAt?: string;
}

export interface TratamientoForm {
  pacienteId: number | null;
  terapeutaId: number | null;
  tipoTerapiaId: number | null;
  estadoTratamientoId: number | null;
  fechaInicio: string;
  fechaFin: string;
  sesionesTotal: number | null;
  precioPorSesion: number | null;
  notas: string;
  activo: boolean;
}

export function tratamientoPaciente(t: Tratamiento): string {
  if (!t.paciente) return '—';
  return `${t.paciente.nombre} ${t.paciente.apellido}`.trim();
}

export function tratamientoTerapeuta(t: Tratamiento): string {
  if (!t.terapeuta?.usuario) return '—';
  return `${t.terapeuta.usuario.nombre} ${t.terapeuta.usuario.apellido}`.trim();
}
