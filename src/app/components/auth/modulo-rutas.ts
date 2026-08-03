/** Mapa único módulo(key backend) → ruta del frontend — usado por el login (redirect) y el guard de rutas. */
export const MODULO_RUTA: Record<string, string> = {
  DASHBOARD: 'dashboard',
  CITAS: 'citas',
  PACIENTES: 'pacientes',
  TERAPEUTAS: 'terapeutas',
  PAGOS: 'pagos',
  CAJA: 'caja',
  PAQUETES: 'tratamientos',
  CONFIGURACIONES: 'configuraciones',
  SEGURIDAD: 'seguridad',
};
