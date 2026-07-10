import { CatalogItem } from '../../../core/models/catalog.model';

export interface TerapeutaHorario {
  id?: number;
  terapeuta?: { id: number };
  terapeutaId?: number;
  diaSemana: number;           // 1=Lunes ... 7=Domingo
  turno?: CatalogItem;
  turnoId?: number;
  horaInicio: string;          // "HH:mm"
  horaFin: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TerapeutaExcepcion {
  id?: number;
  terapeuta?: { id: number };
  terapeutaId?: number;
  fecha: string;               // "YYYY-MM-DD"
  tipo: 'BLOQUEO_TOTAL' | 'BLOQUEO_PARCIAL' | 'EXTRA';
  horaInicio?: string;
  horaFin?: string;
  motivo?: string;
  createdAt?: string;
}

export interface TerapeutaHorarioForm {
  diaSemana: number | null;
  turnoId: number | null;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface TerapeutaExcepcionForm {
  fecha: string;
  tipo: 'BLOQUEO_TOTAL' | 'BLOQUEO_PARCIAL' | 'EXTRA';
  horaInicio: string;
  horaFin: string;
  motivo: string;
}

export const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

export const TIPOS_EXCEPCION = [
  { value: 'BLOQUEO_TOTAL',   label: 'Bloqueo total del día' },
  { value: 'BLOQUEO_PARCIAL', label: 'Bloqueo parcial (horas)' },
  { value: 'EXTRA',           label: 'Disponibilidad extra' },
];

export function diaNombre(n: number): string {
  return DIAS_SEMANA.find(d => d.value === n)?.label ?? `Día ${n}`;
}
