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
  terapeuta_nombre?: string;
  terapeuta_apellido?: string;
  tipo_terapia_nombre?: string;
  especialidad_nombre?: string;
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

export interface ReprogramarCitaRequest {
  nueva_fecha_inicio: Date;
  nueva_fecha_fin: Date;
  nuevo_terapeuta_id?: string;
  nueva_duracion?: number;
  motivo: string;
}