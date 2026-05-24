import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Cita, CrearCitaLocalRequest, CrearCitaRequest, ReprogramarCitaRequest, TipoTerapia } from '../Models/cita.model';

@Injectable({ providedIn: 'root' })
export class CitaService {

  private readonly STORAGE_KEY = 'therateam_citas';

  private tiposTerapia: TipoTerapia[] = [
    { id: 'conv', nombre: 'Convencional', duracion_minutos: 45, max_pacientes: 2 },
    { id: 'pers', nombre: 'Personalizado', duracion_minutos: 40, max_pacientes: 1 },
    { id: 'kids', nombre: 'Kids',          duracion_minutos: 40, max_pacientes: 1 },
  ];

  private nextId = 20;
  private citasMock: Cita[] = this.loadFromStorage();

  private lunesSemana(): Date {
    const hoy = new Date();
    const dow = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + (dow === 0 ? -6 : 1 - dow));
    lunes.setHours(0, 0, 0, 0);
    return lunes;
  }

  private buildMock(): Cita[] {
    const lunes = this.lunesSemana();
    const dia = (offset: number, h: number, m: number): Date => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + offset);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const fin = (inicio: Date, dur: number): Date => {
      const f = new Date(inicio);
      f.setMinutes(f.getMinutes() + dur);
      return f;
    };
    const now = new Date();

    return [
      {
        id: '1', sesion_id: 101, terapeuta_id: 'T1', paciente_id: 'P1', tipo_terapia_id: 1,
        fecha_inicio: dia(0, 9, 0), fecha_fin: fin(dia(0, 9, 0), 45), duracion_minutos: 45,
        modalidad: 'PRESENCIAL', estado: 'PROGRAMADA', recordatorio_enviado: false,
        created_at: now, updated_at: now,
        paciente_nombre: 'Ana', paciente_apellido: 'García',
        terapeuta_nombre: 'María', terapeuta_apellido: 'González',
        tipo_terapia_nombre: 'Convencional', tipo_terapia_key: 'conv',
      },
      {
        id: '2', sesion_id: 102, terapeuta_id: 'T1', paciente_id: 'P2', tipo_terapia_id: 1,
        fecha_inicio: dia(0, 9, 0), fecha_fin: fin(dia(0, 9, 0), 45), duracion_minutos: 45,
        modalidad: 'PRESENCIAL', estado: 'ASISTIDA', recordatorio_enviado: false,
        created_at: now, updated_at: now,
        paciente_nombre: 'Carlos', paciente_apellido: 'López',
        terapeuta_nombre: 'María', terapeuta_apellido: 'González',
        tipo_terapia_nombre: 'Convencional', tipo_terapia_key: 'conv',
      },
      {
        id: '3', sesion_id: 103, terapeuta_id: 'T1', paciente_id: 'P3', tipo_terapia_id: 2,
        fecha_inicio: dia(1, 10, 0), fecha_fin: fin(dia(1, 10, 0), 40), duracion_minutos: 40,
        modalidad: 'PRESENCIAL', estado: 'PROGRAMADA', recordatorio_enviado: false,
        created_at: now, updated_at: now,
        paciente_nombre: 'Lucía', paciente_apellido: 'Martínez',
        terapeuta_nombre: 'María', terapeuta_apellido: 'González',
        tipo_terapia_nombre: 'Personalizado', tipo_terapia_key: 'pers',
      },
      {
        id: '4', sesion_id: 104, terapeuta_id: 'T2', paciente_id: 'P4', tipo_terapia_id: 3,
        fecha_inicio: dia(0, 8, 0), fecha_fin: fin(dia(0, 8, 0), 40), duracion_minutos: 40,
        modalidad: 'PRESENCIAL', estado: 'PROGRAMADA', recordatorio_enviado: false,
        created_at: now, updated_at: now,
        paciente_nombre: 'Sofía', paciente_apellido: 'Ruiz',
        terapeuta_nombre: 'Pedro', terapeuta_apellido: 'Sánchez',
        tipo_terapia_nombre: 'Kids', tipo_terapia_key: 'kids',
      },
      {
        id: '5', sesion_id: 105, terapeuta_id: 'T2', paciente_id: 'P5', tipo_terapia_id: 1,
        fecha_inicio: dia(2, 11, 0), fecha_fin: fin(dia(2, 11, 0), 45), duracion_minutos: 45,
        modalidad: 'VIRTUAL', estado: 'NO_ASISTIO', recordatorio_enviado: false,
        created_at: now, updated_at: now,
        paciente_nombre: 'Roberto', paciente_apellido: 'Torres',
        terapeuta_nombre: 'Pedro', terapeuta_apellido: 'Sánchez',
        tipo_terapia_nombre: 'Convencional', tipo_terapia_key: 'conv',
      },
      {
        id: '6', sesion_id: 106, terapeuta_id: 'T2', paciente_id: 'P6', tipo_terapia_id: 1,
        fecha_inicio: dia(3, 14, 0), fecha_fin: fin(dia(3, 14, 0), 60), duracion_minutos: 60,
        modalidad: 'PRESENCIAL', estado: 'PROGRAMADA', recordatorio_enviado: false,
        created_at: now, updated_at: now,
        paciente_nombre: 'Elena', paciente_apellido: 'Vega',
        terapeuta_nombre: 'Pedro', terapeuta_apellido: 'Sánchez',
        tipo_terapia_nombre: 'Convencional', tipo_terapia_key: 'conv',
      },
      {
        id: '7', sesion_id: 107, terapeuta_id: 'T1', paciente_id: 'P7', tipo_terapia_id: 3,
        fecha_inicio: dia(4, 15, 0), fecha_fin: fin(dia(4, 15, 0), 40), duracion_minutos: 40,
        modalidad: 'PRESENCIAL', estado: 'ASISTIDA', recordatorio_enviado: false,
        created_at: now, updated_at: now,
        paciente_nombre: 'Diego', paciente_apellido: 'Herrera',
        terapeuta_nombre: 'María', terapeuta_apellido: 'González',
        tipo_terapia_nombre: 'Kids', tipo_terapia_key: 'kids',
      },
    ];
  }

  private loadFromStorage(): Cita[] {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed: Cita[] = JSON.parse(raw);
        const dateFields: (keyof Cita)[] = ['fecha_inicio', 'fecha_fin', 'created_at', 'updated_at'];
        const citas = parsed.map(c => {
          const revived: any = { ...c };
          for (const f of dateFields) {
            if (revived[f]) revived[f] = new Date(revived[f]);
          }
          return revived as Cita;
        });
        const maxId = citas.reduce((m, c) => Math.max(m, Number(c.id) || 0), 0);
        if (maxId >= this.nextId) this.nextId = maxId + 1;
        return citas;
      }
    } catch { /* sessionStorage no disponible o datos corruptos */ }
    const initial = this.buildMock();
    this.saveToStorageWith(initial);
    return initial;
  }

  private saveToStorage(): void {
    this.saveToStorageWith(this.citasMock);
  }

  private saveToStorageWith(citas: Cita[]): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(citas));
    } catch { /* cuota excedida u otro error */ }
  }

  getTiposTerapia(): TipoTerapia[] {
    return this.tiposTerapia;
  }

  updateDuracionTipo(id: string, duracion: number): void {
    const t = this.tiposTerapia.find(x => x.id === id);
    if (t) t.duracion_minutos = duracion;
  }

  getCitas(filtros?: any): Observable<Cita[]> {
    let citas = [...this.citasMock];
    if (filtros) {
      if (filtros.estado) citas = citas.filter(c => c.estado === filtros.estado);
      if (filtros.fecha) {
        const fd = new Date(filtros.fecha).toDateString();
        citas = citas.filter(c => new Date(c.fecha_inicio).toDateString() === fd);
      }
      if (filtros.terapeuta_id) citas = citas.filter(c => c.terapeuta_id === filtros.terapeuta_id);
    }
    return of(citas).pipe(delay(300));
  }

  getCitaById(id: string): Observable<Cita> {
    const c = this.citasMock.find(x => x.id === id);
    return c ? of(c).pipe(delay(200)) : throwError(() => new Error('No encontrada'));
  }

  crearCitaLocal(req: CrearCitaLocalRequest): Observable<Cita> {
    const fin = new Date(req.fecha_inicio);
    fin.setMinutes(fin.getMinutes() + req.duracion_minutos);
    const cita: Cita = {
      id: String(this.nextId++),
      sesion_id: this.nextId,
      terapeuta_id: req.terapeuta_nombre,
      paciente_id: req.paciente_nombre,
      tipo_terapia_id: 1,
      fecha_inicio: req.fecha_inicio,
      fecha_fin: fin,
      duracion_minutos: req.duracion_minutos,
      modalidad: 'PRESENCIAL',
      estado: this.colorAEstado(req.estado_color),
      recordatorio_enviado: false,
      created_at: new Date(),
      updated_at: new Date(),
      paciente_nombre: req.paciente_nombre,
      paciente_apellido: req.paciente_apellido,
      paciente_dni: req.paciente_dni,
      paciente_telefono: req.paciente_telefono,
      paciente_correo: req.paciente_correo,
      terapeuta_nombre: req.terapeuta_nombre,
      tipo_terapia_nombre: req.tipo_nombre,
      tipo_terapia_key: req.tipo_key,
      observacion: req.observacion,
    };
    this.citasMock.push(cita);
    this.saveToStorage();
    return of(cita).pipe(delay(200));
  }

  actualizarCitaLocal(id: string, req: CrearCitaLocalRequest): Observable<Cita> {
    const idx = this.citasMock.findIndex(c => c.id === id);
    if (idx === -1) return throwError(() => new Error('No encontrada'));
    const fin = new Date(req.fecha_inicio);
    fin.setMinutes(fin.getMinutes() + req.duracion_minutos);
    this.citasMock[idx] = {
      ...this.citasMock[idx],
      fecha_inicio: req.fecha_inicio,
      fecha_fin: fin,
      duracion_minutos: req.duracion_minutos,
      estado: this.colorAEstado(req.estado_color),
      paciente_nombre: req.paciente_nombre,
      paciente_apellido: req.paciente_apellido,
      paciente_dni: req.paciente_dni,
      paciente_telefono: req.paciente_telefono,
      paciente_correo: req.paciente_correo,
      terapeuta_nombre: req.terapeuta_nombre,
      tipo_terapia_nombre: req.tipo_nombre,
      tipo_terapia_key: req.tipo_key,
      observacion: req.observacion,
      updated_at: new Date(),
    };
    this.saveToStorage();
    return of(this.citasMock[idx]).pipe(delay(200));
  }

  eliminarCitaLocal(id: string): Observable<void> {
    const idx = this.citasMock.findIndex(c => c.id === id);
    if (idx !== -1) { this.citasMock.splice(idx, 1); this.saveToStorage(); }
    return of(void 0).pipe(delay(200));
  }

  crearCita(request: CrearCitaRequest): Observable<Cita> {
    const modalidadValida: 'PRESENCIAL' | 'VIRTUAL' | 'DOMICILIO' =
      ['PRESENCIAL', 'VIRTUAL', 'DOMICILIO'].includes(request.modalidad)
        ? request.modalidad as any : 'PRESENCIAL';
    const cita: Cita = {
      id: String(this.nextId++),
      sesion_id: request.sesion_id,
      terapeuta_id: request.terapeuta_id,
      paciente_id: request.paciente_id,
      tipo_terapia_id: request.tipo_terapia_id,
      fecha_inicio: request.fecha_inicio,
      fecha_fin: request.fecha_fin,
      duracion_minutos: request.duracion_minutos,
      modalidad: modalidadValida,
      estado: 'PROGRAMADA',
      recordatorio_enviado: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.citasMock.push(cita);
    return of(cita).pipe(delay(300));
  }

  reprogramarCita(id: string, request: ReprogramarCitaRequest): Observable<Cita> {
    const idx = this.citasMock.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.citasMock[idx] = {
        ...this.citasMock[idx],
        fecha_inicio: request.nueva_fecha_inicio,
        fecha_fin: request.nueva_fecha_fin,
        estado: 'REPROGRAMADA',
        updated_at: new Date(),
      };
      return of(this.citasMock[idx]).pipe(delay(300));
    }
    return throwError(() => new Error('No encontrada'));
  }

  cancelarCita(id: string, motivo: string): Observable<void> {
    const idx = this.citasMock.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.citasMock[idx].estado = 'CANCELADA_PACIENTE';
      this.citasMock[idx].motivo_cancelacion = motivo;
      this.citasMock[idx].updated_at = new Date();
      return of(void 0).pipe(delay(300));
    }
    return throwError(() => new Error('No encontrada'));
  }

  confirmarCita(id: string): Observable<void> {
    const idx = this.citasMock.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.citasMock[idx].estado = 'CONFIRMADA';
      this.citasMock[idx].updated_at = new Date();
      return of(void 0).pipe(delay(300));
    }
    return throwError(() => new Error('No encontrada'));
  }

  private colorAEstado(color: 'azul' | 'verde' | 'rojo'): Cita['estado'] {
    if (color === 'verde') return 'ASISTIDA';
    if (color === 'rojo') return 'NO_ASISTIO';
    return 'PROGRAMADA';
  }

  getEstadosCita(): string[] {
    return ['PENDIENTE','PROGRAMADA','CONFIRMADA','EN_CURSO','ASISTIDA','NO_ASISTIO','REPROGRAMADA','CANCELADA_PACIENTE','CANCELADA_CLINICA'];
  }

  getModalidades(): string[] {
    return ['PRESENCIAL', 'VIRTUAL', 'DOMICILIO'];
  }
}
