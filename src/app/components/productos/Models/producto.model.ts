export interface Producto {
  id?: number;
  nombre: string;
  descripcion?: string | null;
  precio?: number;
  /** Contador simple: baja al vender, se repone a mano desde el catálogo. */
  stock?: number;
  activo?: boolean;
}

/** Una línea de venta. Al vender solo se manda productoId + cantidad: el precio lo pone el backend
 *  desde el catálogo, para que no se pueda cambiar desde el cliente. */
export interface VentaItem {
  id?: number;
  productoId: number;
  cantidad: number;
  nombreProducto?: string;
  precioUnitario?: number;
  subtotal?: number;
}

/** Fila del reporte "qué se vendió" en un rango de fechas. */
export interface VentaResumen {
  productoId: number;
  nombreProducto: string;
  unidades: number;
  total: number;
}
