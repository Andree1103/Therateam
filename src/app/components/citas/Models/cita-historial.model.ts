export interface CitaHistorial {
  id?: number;
  citaId: number;
  estadoAnterior?: { id: number; key: string; nombre: string; colorHex?: string };
  estadoNuevo?: { id: number; key: string; nombre: string; colorHex?: string };
  fechaAnterior?: string;
  fechaNueva?: string;
  motivo?: string;
  canal?: string;
  usuario?: { id: number; nombre: string; apellido: string };
  createdAt?: string;
}
