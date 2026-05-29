export interface TipoTerapia {
  id: string;
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
  estado: 'PENDIENTE' | 'PROGRAMADA' | 'CONFIRMADA' | 'EN_CURSO' | 'ASISTIDA' | 'NO_ASISTIO' | 'REPROGRAMADA' | 'CANCELADA_PACIENTE' | 'CANCELADA_CLINICA';
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
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_dni?: string;
  paciente_telefono?: string;
  paciente_correo?: string;
  terapeuta_nombre: string;
  tipo_key: string;
  tipo_nombre: string;
  fecha_inicio: Date;
  duracion_minutos: number;
  estado_color: 'azul' | 'verde' | 'rojo';
  observacion?: string;
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
