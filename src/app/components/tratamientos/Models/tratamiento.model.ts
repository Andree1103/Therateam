export interface Tratamiento {
  id?: number;
  nombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  notas?: string;
  activo?: boolean;
  createdAt?: string;

  // Paciente (flat desde TratamientoDTO)
  pacienteId?: number;
  pacienteNombre?: string;
  pacienteApellido?: string;
  pacienteDni?: string;
  pacienteTelefono?: string;

  // Terapeuta (flat)
  terapeutaId?: number;
  terapeutaNombre?: string;

  // Tipo terapia (flat)
  tipoTerapiaKey?: string;
  tipoTerapiaNombre?: string;

  // Estado (flat)
  estadoKey?: string;
  estadoNombre?: string;
  estadoColor?: string;

  // Financiero
  precioPorSesion?: number;
  montoTotal?: number;
  totalCobrado?: number;
  saldoAFavor?: number;

  // Sesiones
  totalSesiones?: number;
  sesionesAtendidas?: number;
  sesionesPendientes?: number;

  usuarioCreacionNombre?: string;
}

/** Cuántas sesiones ya tienen cita creada y cuántas de esas están pagadas/pendientes de pago. */
export interface TratamientoCobertura {
  sesionesCreadas: number;
  sesionesPagadas: number;
  sesionesPendientesPago: number;
}

export interface TratamientoForm {
  pacienteId: number | null;
  terapeutaId: number | null;
  tipoTerapiaId: number | null;
  estadoTratamientoId: number | null;
  fechaInicio: string;
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
  estadoPagoKey?: string;
  estadoPagoNombre?: string;
  estadoPagoColor?: string;
  precio?: number;
  montoPagado?: number;
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
  if (!t.pacienteNombre) return '—';
  return `${t.pacienteNombre} ${t.pacienteApellido || ''}`.trim();
}

export function tratamientoTerapeuta(t: Tratamiento): string {
  return t.terapeutaNombre || '—';
}
