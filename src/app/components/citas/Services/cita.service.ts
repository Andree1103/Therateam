import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Cita, CrearCitaRequest, ReprogramarCitaRequest } from '../Models/cita.model';

@Injectable({
  providedIn: 'root'
})
export class CitaService {
  private citasMock: Cita[] = [
    {
      id: '1',
      sesion_id: 101,
      terapeuta_id: '2',
      paciente_id: '1001',
      tipo_terapia_id: 1,
      fecha_inicio: new Date(new Date().setHours(9, 0, 0, 0)),
      fecha_fin: new Date(new Date().setHours(9, 50, 0, 0)),
      duracion_minutos: 50,
      modalidad: 'PRESENCIAL',
      estado: 'PROGRAMADA',
      recordatorio_enviado: false,
      created_at: new Date(),
      updated_at: new Date(),
      paciente_nombre: 'Juan',
      paciente_apellido: 'Pérez',
      terapeuta_nombre: 'María',
      terapeuta_apellido: 'González',
      tipo_terapia_nombre: 'Evaluación Inicial',
      especialidad_nombre: 'Fisioterapia'
    },
    {
      id: '2',
      sesion_id: 102,
      terapeuta_id: '2',
      paciente_id: '1002',
      tipo_terapia_id: 3,
      fecha_inicio: new Date(new Date().setHours(10, 0, 0, 0)),
      fecha_fin: new Date(new Date().setHours(10, 50, 0, 0)),
      duracion_minutos: 50,
      modalidad: 'VIRTUAL',
      estado: 'CONFIRMADA',
      recordatorio_enviado: false,
      created_at: new Date(),
      updated_at: new Date(),
      paciente_nombre: 'María',
      paciente_apellido: 'López',
      terapeuta_nombre: 'María',
      terapeuta_apellido: 'González',
      tipo_terapia_nombre: 'Columna',
      especialidad_nombre: 'Fisioterapia'
    },
    {
      id: '3',
      sesion_id: 103,
      terapeuta_id: '2',
      paciente_id: '1003',
      tipo_terapia_id: 5,
      fecha_inicio: new Date(new Date().setHours(11, 0, 0, 0)),
      fecha_fin: new Date(new Date().setHours(12, 0, 0, 0)),
      duracion_minutos: 60,
      modalidad: 'PRESENCIAL',
      estado: 'PENDIENTE',
      recordatorio_enviado: false,
      created_at: new Date(),
      updated_at: new Date(),
      paciente_nombre: 'Carlos',
      paciente_apellido: 'Rodríguez',
      terapeuta_nombre: 'María',
      terapeuta_apellido: 'González',
      tipo_terapia_nombre: 'Post Operatorio',
      especialidad_nombre: 'Fisioterapia'
    }
  ];

  getCitas(filtros?: any): Observable<Cita[]> {
    let citas = [...this.citasMock];
    
    if (filtros) {
      if (filtros.estado) {
        citas = citas.filter(c => c.estado === filtros.estado);
      }
      if (filtros.fecha) {
        const fechaFiltro = new Date(filtros.fecha).toDateString();
        citas = citas.filter(c => new Date(c.fecha_inicio).toDateString() === fechaFiltro);
      }
      if (filtros.terapeuta_id) {
        citas = citas.filter(c => c.terapeuta_id === filtros.terapeuta_id);
      }
    }
    
    return of(citas).pipe(delay(500));
  }

  getCitaById(id: string): Observable<Cita> {
    const cita = this.citasMock.find(c => c.id === id);
    if (cita) {
      return of(cita).pipe(delay(300));
    }
    return throwError(() => new Error('Cita no encontrada'));
  }

  crearCita(request: CrearCitaRequest): Observable<Cita> {
    // Validar que modalidad sea del tipo correcto
    const modalidadValida: 'PRESENCIAL' | 'VIRTUAL' | 'DOMICILIO' = 
      request.modalidad === 'PRESENCIAL' || request.modalidad === 'VIRTUAL' || request.modalidad === 'DOMICILIO'
        ? request.modalidad as 'PRESENCIAL' | 'VIRTUAL' | 'DOMICILIO'
        : 'PRESENCIAL';
    
    const nuevaCita: Cita = {
      id: (this.citasMock.length + 1).toString(),
      sesion_id: request.sesion_id,
      terapeuta_id: request.terapeuta_id,
      paciente_id: request.paciente_id,
      tipo_terapia_id: request.tipo_terapia_id,
      fecha_inicio: request.fecha_inicio,
      fecha_fin: request.fecha_fin,
      duracion_minutos: request.duracion_minutos,
      modalidad: modalidadValida,  // Usar el valor validado
      estado: 'PROGRAMADA',
      recordatorio_enviado: false,
      created_at: new Date(),
      updated_at: new Date(),
      paciente_nombre: 'Nuevo',
      paciente_apellido: 'Paciente',
      terapeuta_nombre: 'María',
      terapeuta_apellido: 'González',
      tipo_terapia_nombre: 'Terapia General'
    };
    
    this.citasMock.push(nuevaCita);
    return of(nuevaCita).pipe(delay(500));
  }

  reprogramarCita(id: string, request: ReprogramarCitaRequest): Observable<Cita> {
    const citaIndex = this.citasMock.findIndex(c => c.id === id);
    if (citaIndex !== -1) {
      this.citasMock[citaIndex] = {
        ...this.citasMock[citaIndex],
        fecha_inicio: request.nueva_fecha_inicio,
        fecha_fin: request.nueva_fecha_fin,
        estado: 'REPROGRAMADA',
        updated_at: new Date()
      };
      return of(this.citasMock[citaIndex]).pipe(delay(500));
    }
    return throwError(() => new Error('Cita no encontrada'));
  }

  cancelarCita(id: string, motivo: string): Observable<void> {
    const citaIndex = this.citasMock.findIndex(c => c.id === id);
    if (citaIndex !== -1) {
      this.citasMock[citaIndex].estado = 'CANCELADA_PACIENTE';
      this.citasMock[citaIndex].motivo_cancelacion = motivo;
      this.citasMock[citaIndex].updated_at = new Date();
      return of(void 0).pipe(delay(500));
    }
    return throwError(() => new Error('Cita no encontrada'));
  }

  confirmarCita(id: string): Observable<void> {
    const citaIndex = this.citasMock.findIndex(c => c.id === id);
    if (citaIndex !== -1) {
      this.citasMock[citaIndex].estado = 'CONFIRMADA';
      this.citasMock[citaIndex].updated_at = new Date();
      return of(void 0).pipe(delay(500));
    }
    return throwError(() => new Error('Cita no encontrada'));
  }

  getEstadosCita(): string[] {
    return [
      'PENDIENTE',
      'PROGRAMADA',
      'CONFIRMADA',
      'EN_CURSO',
      'ASISTIDA',
      'NO_ASISTIO',
      'REPROGRAMADA',
      'CANCELADA_PACIENTE',
      'CANCELADA_CLINICA'
    ];
  }

  getModalidades(): string[] {
    return ['PRESENCIAL', 'VIRTUAL', 'DOMICILIO'];
  }
}