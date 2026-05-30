export interface TipoTerapia {
  id: string;           // usa key del DB (ej: 'CONVENCIONAL', 'KIDS')
  nombre: string;
  duracion_minutos: number;
  max_pacientes: number;
}

export interface Cita {
  id: string;
  sesion_id: number;
  terapeuta_id: string;
  paciente_id: string;
  tipo_terapia_id: number;
  fecha_inicio: Date;
  fecha_fin: Date;
  duracion_minutos: number;
  modalidad: 'PRESENCIAL' | 'VIRTUAL' | 'DOMICILIO';
  estado: string;
  motivo_cancelacion?: string;
  notas_previas?: string;
  notas_post?: string;
  link_videollamada?: string;
  recordatorio_enviado: boolean;
  created_at: Date;
  updated_at: Date;

  paciente_nombre?: string;
  paciente_apellido?: string;
  paciente_dni?: string;
  paciente_telefono?: string;
  paciente_correo?: string;
  terapeuta_nombre?: string;
  terapeuta_apellido?: string;
  tipo_terapia_nombre?: string;
  tipo_terapia_key?: string;
  especialidad_nombre?: string;
  observacion?: string;
}

export interface CrearCitaRequest {
  sesion_id: number;
  terapeuta_id: string;
  paciente_id: string;
  tipo_terapia_id: number;
  fecha_inicio: Date;
  fecha_fin: Date;
  duracion_minutos: number;
  modalidad: string;
  notas_previas?: string;
}

export interface CrearCitaLocalRequest {
  // IDs para las FK @ManyToOne de la entidad Cita
  terapeuta_id?: number;
  sesion_id?: number;
  estado_id?: number;
  modalidad_id?: number;
  // Campos de la cita
  fecha_inicio: Date;
  duracion_minutos: number;
  notas_previas?: string;
  recordatorio_enviado?: boolean;
  // Helpers para el backend (citaDTO / lógica adicional)
  estado_key: string;
  modalidad_key: string;
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_dni?: string;
  paciente_telefono?: string;
  paciente_correo?: string;
  terapeuta_nombre: string;
  tipo_key: string;
  tipo_nombre: string;
  observacion?: string;
}

export interface PacienteEnCita {
  id?: number;
  dni: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  correo?: string;
}

export interface CrearCitaConPacienteRequest {
  paciente: PacienteEnCita;
  paciente2?: PacienteEnCita | null;
  terapeutaNombre: string;
  tipoKey: string;
  fechaInicio: string;
  duracionMinutos: number;
  estadoKey: string;
  modalidadKey: string;
  observacion?: string;
}

export interface PacienteResumen {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  correo?: string;
}

export interface ReprogramarCitaRequest {
  nueva_fecha_inicio: Date;
  nueva_fecha_fin: Date;
  nuevo_terapeuta_id?: string;
  nueva_duracion?: number;
  motivo: string;
}

/** Shape exacta que devuelve el backend Spring Boot (snake_case) */
export interface CitaApiDTO {
  id: number | string;
  sesion_id?: number;
  terapeuta_id?: string | number;
  paciente_id?: string | number;
  tipo_terapia_id?: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  duracion_minutos?: number;
  modalidad: string;
  estado: string;
  motivo_cancelacion?: string;
  notas_previas?: string;
  notas_post?: string;
  link_videollamada?: string;
  recordatorio_enviado?: boolean;
  created_at?: string;
  updated_at?: string;
  paciente_nombre?: string;
  paciente_apellido?: string;
  paciente_dni?: string;
  paciente_telefono?: string;
  paciente_correo?: string;
  terapeuta_nombre?: string;
  terapeuta_apellido?: string;
  tipo_terapia_nombre?: string;
  tipo_terapia_key?: string;
  observacion?: string;
}
