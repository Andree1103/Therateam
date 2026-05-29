import { CatalogItem, Sede } from '../../../core/models/catalog.model';

export interface Paciente {
  id?: number;
  nombre: string;
  apellido: string;
  dni?: string;
  telefono?: string;
  correo?: string;
  fechaNacimiento?: string;
  origen?: CatalogItem;
  sede?: Sede;
  notas?: string;
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PacienteForm {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  correo: string;
  fechaNacimiento: string;
  notas: string;
  activo: boolean;
  sedeId: number | null;
  origenId: number | null;
}
