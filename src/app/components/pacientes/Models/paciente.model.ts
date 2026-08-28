import { CatalogItem, Sede } from '../../../core/models/catalog.model';

export interface Paciente {
  id?: number;
  nombre: string;
  apellido: string;
  dni?: string;
  telefono?: string;
  correo?: string;
  fechaNacimiento?: string;
  /** Solo obligatorios cuando el paciente es menor de 18 años. */
  dniApoderado?: string;
  nombreApoderado?: string;
  celularApoderado?: string;
  origen?: CatalogItem;
  sede?: Sede;
  notas?: string;
  activo?: boolean;
  /** Crédito del paciente (adelantos pagados de más contra cualquier paquete o cita suya, aún sin aplicar). */
  saldoAFavor?: number;
  createdAt?: string;
  updatedAt?: string;
  usuarioCreacionNombre?: string;
  /** Último movimiento del saldo a favor — solo viene en el reporte de Adelantos. */
  saldoUltimoMotivo?: string;
  saldoUltimoTerapeuta?: string;
  saldoUltimaFecha?: string;
}

export interface PacienteForm {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  correo: string;
  fechaNacimiento: string;
  dniApoderado: string;
  nombreApoderado: string;
  celularApoderado: string;
  notas: string;
  activo: boolean;
  sedeId: number | null;
  origenId: number | null;
}

/** Una linea del estado de cuenta del saldo a favor. */
export interface SaldoMovimiento {
  id: number;
  pacienteId: number;
  /** Con signo: positivo suma saldo, negativo lo consume. */
  monto: number;
  saldoResultante: number;
  motivo: string;
  terapeutaNombre?: string | null;
  citaId?: number | null;
  pagoId?: number | null;
  fecha: string;
}
