export interface DisponibilidadFranja {
  horaInicio: string; // "HH:MM:SS"
  horaFin: string;    // "HH:MM:SS"
}

export interface DisponibilidadDia {
  fecha: string;       // "YYYY-MM-DD"
  diaSemana: number;   // 1 (lunes) .. 7 (domingo)
  franjas: DisponibilidadFranja[];
}
