export interface CatalogItem {
  id: number;
  key?: string;
  nombre: string;
  activo?: boolean;
  colorHex?: string;
  codigo?: string;
  simbolo?: string;
  duracionMinutos?: number;
  maxPacientes?: number;
  area?: { id: number; nombre?: string; key?: string } | null;
  especialidad?: { id: number; nombre?: string; key?: string } | null;
  sesionesSugeridas?: number | null;
  comentario?: string | null;
  precioRecomendado?: number | null;
  // Plantillas de paquete (catálogo)
  categoria?: string | null;
  tipoTerapia?: { id: number; nombre?: string; key?: string; area?: { id: number; nombre?: string } | null } | null;
  totalSesiones?: number | null;
  precioTotal?: number | null;
  /**
   * Solo en Métodos de pago: si los cobros con este método suman al arqueo del cierre de caja.
   * false deja el pago registrado y la cita saldada, pero fuera del total de caja.
   */
  cuentaEnCaja?: boolean;
}

export interface Sede {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  activo?: boolean;
}
