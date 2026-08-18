import { CatalogItem } from '../../../core/models/catalog.model';
import { Paciente } from '../../pacientes/Models/paciente.model';

export interface TratamientoBasico {
  id: number;
  nombre: string;
  terapeutaNombre?: string;
  tipoTerapiaNombre?: string;
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
  /** Concepto libre para cobros adicionales (ej. "Material adicional"). */
  concepto?: string;
  /** true = cobro adicional: ingreso aparte, no paga deuda ni genera saldo a favor. */
  esAdicional?: boolean;
  /** true = este registro es la devolución de otro pago (dinero que salió, no que entró). */
  esDevolucion?: boolean;
  usuarioCreacionNombre?: string;
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
