import { CatalogItem } from '../../../core/models/catalog.model';
import { Paciente } from '../../pacientes/Models/paciente.model';

export interface TratamientoBasico {
  id: number;
  nombre: string;
  totalSesiones?: number;
  precioPorSesion?: number;
  montoTotal?: number;
  totalCobrado?: number;
  saldoAFavor?: number;
}

export interface Pago {
  id?: number;
  tratamiento?: TratamientoBasico;
  paciente?: Paciente;
  metodo?: CatalogItem;
  cita?: { id: number };
  montoRecibido?: number;
  montoAplicado?: number;
  saldoGenerado?: number;
  saldoPrevio?: number;
  referencia?: string;
  notas?: string;
  fechaPago?: string;
  registradoPor?: { id: number; nombre: string; apellido: string };
  createdAt?: string;
}

export interface PagoForm {
  pacienteId: number | null;
  tratamientoId: number | null;
  citaId: number | null;
  metodoId: number | null;
  montoRecibido: number | null;
  referencia: string;
  notas: string;
  fechaPago: string;
}
