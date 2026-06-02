import { CatalogItem } from '../../../core/models/catalog.model';

export interface Tratamiento {
  id?: number;
  paciente?: { id: number; nombre: string; apellido: string; };
  terapeuta?: { id: number; usuario?: { nombre: string; apellido: string; }; };
  tipoTerapia?: CatalogItem;
  estadoTratamiento?: CatalogItem;
  nombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  sesionesTotal?: number;
  sesionesAtendidas?: number;
  sesionesPendientes?: number;
  precioPorSesion?: number;
  montoTotal?: number;
  totalCobrado?: number;
  saldoAFavor?: number;
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

export interface CitaResumen {
  id: number;
  fechaInicio: string;
  fechaFin?: string;
  duracionMinutos?: number;
  estado: { id: number; key: string; nombre: string; colorHex?: string; };
  modalidad?: { key: string; nombre: string; };
}

export interface Sesion {
  id: number;
  numero: number;
  estado: { id: number; key: string; nombre: string; colorHex?: string; };
  citaActiva?: CitaResumen;
}

export interface TratamientoDetalle extends Tratamiento {
  sesiones?: Sesion[];
}

export function tratamientoPaciente(t: Tratamiento): string {
  if (!t.paciente) return '—';
  return `${t.paciente.nombre} ${t.paciente.apellido}`.trim();
}

export function tratamientoTerapeuta(t: Tratamiento): string {
  if (!t.terapeuta?.usuario) return '—';
  return `${t.terapeuta.usuario.nombre} ${t.terapeuta.usuario.apellido}`.trim();
}
