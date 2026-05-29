import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Cita, CitaApiDTO, CrearCitaLocalRequest, CrearCitaRequest, ReprogramarCitaRequest, TipoTerapia } from '../Models/cita.model';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class CitaService {

  private readonly PATH = '/api/citas';

  private tiposTerapia: TipoTerapia[] = [
    { id: 'conv', nombre: 'Convencional', duracion_minutos: 45, max_pacientes: 2 },
    { id: 'pers', nombre: 'Personalizado', duracion_minutos: 40, max_pacientes: 1 },
    { id: 'kids', nombre: 'Kids',          duracion_minutos: 40, max_pacientes: 1 },
  ];

  constructor(private api: ApiService) {}

  // ── Catálogo local (hasta que exista GET /api/tipos-terapia) ───────────────
  getTiposTerapia(): TipoTerapia[] {
    return this.tiposTerapia;
  }

  updateDuracionTipo(id: string, duracion: number): void {
    const t = this.tiposTerapia.find(x => x.id === id);
    if (t) t.duracion_minutos = duracion;
  }

  // ── Listado ────────────────────────────────────────────────────────────────
  getCitas(filtros?: { fechaInicio?: Date; fechaFin?: Date; terapeuta?: string }): Observable<Cita[]> {
    const hasFiltros = filtros && (filtros.fechaInicio || filtros.fechaFin || filtros.terapeuta);
    if (!hasFiltros) {
      return this.api.get<CitaApiDTO[]>(this.PATH).pipe(map(list => list.map(d => this.mapDTO(d))));
    }
    return this.api.get<CitaApiDTO[]>(`${this.PATH}/filtro`, {
      fechaInicio: filtros!.fechaInicio ? this.toISOLocal(filtros!.fechaInicio) : undefined,
      fechaFin:    filtros!.fechaFin    ? this.toISOLocal(filtros!.fechaFin)    : undefined,
      terapeuta:   filtros!.terapeuta,
    }).pipe(map(list => list.map(d => this.mapDTO(d))));
  }

  getCitaById(id: string): Observable<Cita> {
    return this.api.get<CitaApiDTO>(`${this.PATH}/${id}`).pipe(map(d => this.mapDTO(d)));
  }

  // ── Crear ──────────────────────────────────────────────────────────────────
  crearCitaLocal(req: CrearCitaLocalRequest): Observable<Cita> {
    return this.api.post<CitaApiDTO>(this.PATH, this.buildBody(req)).pipe(map(d => this.mapDTO(d)));
  }

  // ── Actualizar ─────────────────────────────────────────────────────────────
  actualizarCitaLocal(id: string, req: CrearCitaLocalRequest): Observable<Cita> {
    return this.api.put<CitaApiDTO>(`${this.PATH}/${id}`, this.buildBody(req)).pipe(map(d => this.mapDTO(d)));
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  eliminarCitaLocal(id: string): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }

  // ── Crear cita (usado por crear-cita component) ───────────────────────────
  crearCita(req: CrearCitaRequest): Observable<Cita> {
    return this.api.post<CitaApiDTO>(this.PATH, {
      sesion_id:        req.sesion_id,
      terapeuta_id:     req.terapeuta_id,
      paciente_id:      req.paciente_id,
      tipo_terapia_id:  req.tipo_terapia_id,
      fecha_inicio:     req.fecha_inicio instanceof Date ? req.fecha_inicio.toISOString() : req.fecha_inicio,
      fecha_fin:        req.fecha_fin     instanceof Date ? req.fecha_fin.toISOString()    : req.fecha_fin,
      duracion_minutos: req.duracion_minutos,
      modalidad:        req.modalidad,
      notas_previas:    req.notas_previas,
    }).pipe(map(d => this.mapDTO(d)));
  }

  // ── Reprogramar cita (usado por detalle-cita component) ───────────────────
  reprogramarCita(id: string, req: ReprogramarCitaRequest): Observable<Cita> {
    return this.api.put<CitaApiDTO>(`${this.PATH}/${id}`, {
      estado:              'REPROGRAMADA',
      fecha_inicio:        req.nueva_fecha_inicio instanceof Date ? req.nueva_fecha_inicio.toISOString() : req.nueva_fecha_inicio,
      fecha_fin:           req.nueva_fecha_fin     instanceof Date ? req.nueva_fecha_fin.toISOString()    : req.nueva_fecha_fin,
      duracion_minutos:    req.nueva_duracion,
      motivo_cancelacion:  req.motivo,
    }).pipe(map(d => this.mapDTO(d)));
  }

  // ── Acciones de estado ─────────────────────────────────────────────────────
  confirmarCita(id: string): Observable<Cita> {
    return this.api.put<CitaApiDTO>(`${this.PATH}/${id}`, { estado: 'CONFIRMADA' }).pipe(map(d => this.mapDTO(d)));
  }

  cancelarCita(id: string, motivo: string): Observable<Cita> {
    return this.api.put<CitaApiDTO>(`${this.PATH}/${id}`, { estado: 'CANCELADA_PACIENTE', motivoCancelacion: motivo }).pipe(map(d => this.mapDTO(d)));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getEstadosCita(): string[] {
    return ['PENDIENTE','PROGRAMADA','CONFIRMADA','EN_CURSO','ASISTIDA','NO_ASISTIO','REPROGRAMADA','CANCELADA_PACIENTE','CANCELADA_CLINICA'];
  }

  getModalidades(): string[] {
    return ['PRESENCIAL', 'VIRTUAL', 'DOMICILIO'];
  }

  private buildBody(req: CrearCitaLocalRequest): Record<string, unknown> {
    const fin = new Date(req.fecha_inicio);
    fin.setMinutes(fin.getMinutes() + req.duracion_minutos);
    const tipo = this.tiposTerapia.find(t => t.id === req.tipo_key);
    return {
      fecha_inicio:        req.fecha_inicio.toISOString(),
      fecha_fin:           fin.toISOString(),
      duracion_minutos:    req.duracion_minutos,
      modalidad:           'PRESENCIAL',
      estado:              this.colorAEstado(req.estado_color),
      paciente_nombre:     req.paciente_nombre,
      paciente_apellido:   req.paciente_apellido,
      paciente_dni:        req.paciente_dni,
      paciente_telefono:   req.paciente_telefono,
      paciente_correo:     req.paciente_correo,
      terapeuta_nombre:    req.terapeuta_nombre,
      tipo_terapia_nombre: tipo?.nombre,
      tipo_terapia_key:    req.tipo_key,
      observacion:         req.observacion,
      recordatorio_enviado: false,
    };
  }

  private mapDTO(dto: CitaApiDTO): Cita {
    return {
      id:                  String(dto.id),
      sesion_id:           dto.sesion_id ?? 0,
      terapeuta_id:        String(dto.terapeuta_id ?? ''),
      paciente_id:         String(dto.paciente_id ?? ''),
      tipo_terapia_id:     dto.tipo_terapia_id ?? 1,
      fecha_inicio:        dto.fecha_inicio ? new Date(dto.fecha_inicio) : new Date(0),
      fecha_fin:           dto.fecha_fin    ? new Date(dto.fecha_fin)    : new Date(0),
      duracion_minutos:    dto.duracion_minutos ?? 45,
      modalidad:           (dto.modalidad as Cita['modalidad']) ?? 'PRESENCIAL',
      estado:              (dto.estado as Cita['estado']) ?? 'PROGRAMADA',
      motivo_cancelacion:  dto.motivo_cancelacion,
      notas_previas:       dto.notas_previas,
      notas_post:          dto.notas_post,
      link_videollamada:   dto.link_videollamada,
      recordatorio_enviado: dto.recordatorio_enviado ?? false,
      created_at:          dto.created_at ? new Date(dto.created_at) : new Date(),
      updated_at:          dto.updated_at ? new Date(dto.updated_at) : new Date(),
      paciente_nombre:     dto.paciente_nombre,
      paciente_apellido:   dto.paciente_apellido,
      paciente_dni:        dto.paciente_dni,
      paciente_telefono:   dto.paciente_telefono,
      paciente_correo:     dto.paciente_correo,
      terapeuta_nombre:    dto.terapeuta_nombre,
      terapeuta_apellido:  dto.terapeuta_apellido,
      tipo_terapia_nombre: dto.tipo_terapia_nombre,
      tipo_terapia_key:    dto.tipo_terapia_key,
      observacion:         dto.observacion,
    };
  }

  private colorAEstado(color: 'azul' | 'verde' | 'rojo'): string {
    if (color === 'verde') return 'ASISTIDA';
    if (color === 'rojo')  return 'NO_ASISTIO';
    return 'PROGRAMADA';
  }

  private toISOLocal(d: Date): string {
    return d.toISOString().slice(0, 19);
  }
}
