import { Injectable } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { PageResponse } from '../../../core/models/page.model';
import { Cita, CitaApiDTO, CrearCitaConPacienteRequest, CrearCitaLocalRequest, CrearCitaRequest, LoteResumen, PacienteResumen, ReprogramarCitaRequest, TipoTerapia } from '../Models/cita.model';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class CitaService {

  private readonly PATH = '/api/citas';

  constructor(private api: ApiService) {}

  // ── Buscar paciente por DNI ───────────────────────────────────────────────
  buscarPorDni(dni: string): Observable<PacienteResumen | null> {
    return this.api.get<PacienteResumen>('/api/pacientes/buscar', { dni }).pipe(
      catchError(() => of(null))
    );
  }

  // ── Buscar pacientes por nombre (autocompletado) ──────────────────────────
  buscarPorNombre(nombre: string): Observable<PacienteResumen[]> {
    return this.api.get<{ content: PacienteResumen[] } | PacienteResumen[]>(
      '/api/pacientes', { nombre, size: '8' }
    ).pipe(
      map(r => Array.isArray(r) ? r : r.content),
      catchError(() => of([]))
    );
  }

  // ── Crear cita con paciente (atómico) ─────────────────────────────────────
  crearConPaciente(req: CrearCitaConPacienteRequest): Observable<Cita[]> {
    return this.api.post<CitaApiDTO[]>('/api/citas/con-paciente', req).pipe(
      map(list => list.map(d => this.mapDTO(d)))
    );
  }

  // ── Catálogo tipos de terapia desde BD ────────────────────────────────────
  getTiposTerapiaFromApi(): Observable<TipoTerapia[]> {
    return this.api.get<any[]>('/api/tipos-terapia').pipe(
      map(list => list.map(t => ({
        id:               (t.key || String(t.id)).toUpperCase(),
        nombre:           t.nombre,
        duracion_minutos: t.duracionMinutos ?? t.duracion_minutos ?? 45,
        max_pacientes:    t.maxPacientes    ?? t.max_pacientes    ?? 1,
        area_id:          t.area?.id ?? null,
        area_nombre:      t.area?.nombre ?? null,
        precio_recomendado: t.precioRecomendado ?? null,
      } as TipoTerapia))),
      catchError(() => of([
        { id: 'CONVENCIONAL', nombre: 'Convencional', duracion_minutos: 45, max_pacientes: 2 },
        { id: 'KIDS',         nombre: 'Kids',          duracion_minutos: 45, max_pacientes: 1 },
      ] as TipoTerapia[]))
    );
  }

  // ── Listado ────────────────────────────────────────────────────────────────
  getCitas(filtros?: { fechaInicio?: Date; fechaFin?: Date; terapeuta?: string }): Observable<Cita[]> {
    const hasFiltros = filtros && (filtros.fechaInicio || filtros.fechaFin || filtros.terapeuta);
    if (!hasFiltros) {
      return this.api.get<PageResponse<CitaApiDTO> | CitaApiDTO[]>(this.PATH, { size: '1000' }).pipe(
        map(r => (Array.isArray(r) ? r : r.content).map(d => this.mapDTO(d)))
      );
    }
    return this.api.get<PageResponse<CitaApiDTO> | CitaApiDTO[]>(`${this.PATH}/filtro`, {
      fechaInicio: filtros!.fechaInicio ? this.toISOLocal(filtros!.fechaInicio) : undefined,
      fechaFin:    filtros!.fechaFin    ? this.toISOLocal(filtros!.fechaFin)    : undefined,
      terapeuta:   filtros!.terapeuta,
      size: '1000',
    }).pipe(map(r => (Array.isArray(r) ? r : r.content).map(d => this.mapDTO(d))));
  }

  /** Listado paginado por filtros (usado por el módulo Atenciones: estadoKey='ASISTIDA' + terapeuta/paciente/área/fecha).
   *  `sort` es el formato de Spring Data: "propiedad,asc|desc" (ej. "paciente.nombre,asc"). */
  getFiltroPaged(page: number, size: number, filtros: {
    fechaInicio?: Date; fechaFin?: Date; terapeuta?: string; estadoKey?: string; paciente?: string; areaId?: number | null;
  }, sort?: string): Observable<PageResponse<Cita>> {
    return this.api.get<PageResponse<CitaApiDTO>>(`${this.PATH}/filtro`, {
      page: String(page), size: String(size),
      fechaInicio: filtros.fechaInicio ? this.toISOLocal(filtros.fechaInicio) : undefined,
      fechaFin:    filtros.fechaFin    ? this.toISOLocal(filtros.fechaFin)    : undefined,
      terapeuta:   filtros.terapeuta || undefined,
      estadoKey:   filtros.estadoKey || undefined,
      paciente:    filtros.paciente || undefined,
      areaId:      filtros.areaId != null ? String(filtros.areaId) : undefined,
      sort:        sort || undefined,
    }).pipe(map(r => ({ ...r, content: r.content.map(d => this.mapDTO(d)) })));
  }

  getCitaById(id: string): Observable<Cita> {
    return this.api.get<CitaApiDTO>(`${this.PATH}/${id}`).pipe(map(d => this.mapDTO(d)));
  }

  /** Cuántas citas de un lote de "citas masivas" faltan/ya se atendieron/se cancelaron. */
  getResumenLote(loteMasivoId: string): Observable<LoteResumen | null> {
    return this.api.get<LoteResumen>(`${this.PATH}/lote/${loteMasivoId}/resumen`).pipe(
      catchError(() => of(null))
    );
  }

  /** Historial de citas de un paciente — directo, ya no depende de sesión/tratamiento. */
  getByPaciente(pacienteId: number): Observable<Cita[]> {
    return this.api.get<CitaApiDTO[]>(`${this.PATH}/paciente/${pacienteId}`).pipe(
      map(list => list.map(d => this.mapDTO(d)))
    );
  }

  // ── Crear ──────────────────────────────────────────────────────────────────
  crearCitaLocal(req: CrearCitaLocalRequest): Observable<Cita> {
    return this.api.post<CitaApiDTO>(this.PATH, this.buildBody(req)).pipe(map(d => this.mapDTO(d)));
  }

  // ── Actualizar ─────────────────────────────────────────────────────────────
  actualizarCitaLocal(id: string, req: CrearCitaLocalRequest): Observable<void> {
    return this.api.put<unknown>(`${this.PATH}/${id}`, this.buildBody(req)).pipe(
      map(() => undefined as void),
      catchError(err => {
        // Si el HTTP status es 2xx, el UPDATE fue exitoso aunque el body sea malformado
        if (err?.status >= 200 && err?.status < 300) return of(undefined as void);
        throw err;
      })
    );
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  eliminarCitaLocal(id: string): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}`);
  }

  /**
   * Anula la cita (queda CANCELADA_CLINICA) y resuelve el pago asociado:
   * `devolucion` = 'SALDO' (default) deja el monto como saldo a favor del paciente;
   * 'DINERO' revierte y elimina el pago (devolución real, no genera saldo).
   */
  anularCita(id: string, devolucion: 'SALDO' | 'DINERO' = 'SALDO', metodoId?: number | null): Observable<Cita> {
    const qs = metodoId != null ? `?devolucion=${devolucion}&metodoId=${metodoId}` : `?devolucion=${devolucion}`;
    return this.api.post<CitaApiDTO>(`${this.PATH}/${id}/anular${qs}`, {}).pipe(
      map(d => this.mapDTO(d))
    );
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

  // ── Reprogramar cita ───────────────────────────────────────────────────────
  reprogramarCita(id: string, req: ReprogramarCitaRequest): Observable<Cita> {
    return this.api.put<CitaApiDTO>(`${this.PATH}/${id}`, {
      estado:              'REPROGRAMADA',
      fecha_inicio:        req.nueva_fecha_inicio instanceof Date ? req.nueva_fecha_inicio.toISOString() : req.nueva_fecha_inicio,
      fecha_fin:           req.nueva_fecha_fin     instanceof Date ? req.nueva_fecha_fin.toISOString()    : req.nueva_fecha_fin,
      duracion_minutos:    req.nueva_duracion,
      motivo_cancelacion:  req.motivo,
    }).pipe(map(d => this.mapDTO(d)));
  }

  /** Actualiza el estado de pago de una cita (SIN_PAGO | PARCIAL | PAGADA) */
  patchEstadoPago(id: string, key: string): Observable<Cita> {
    return this.api.patch<CitaApiDTO>(`${this.PATH}/${id}/estado-pago`, {}, { key }).pipe(
      map((d: CitaApiDTO) => this.mapDTO(d))
    );
  }

  // ── Acciones de estado ─────────────────────────────────────────────────────
  confirmarCita(id: string): Observable<Cita> {
    return this.api.put<CitaApiDTO>(`${this.PATH}/${id}`, { estado: 'CONFIRMADA' }).pipe(map(d => this.mapDTO(d)));
  }

  cancelarCita(id: string, motivo: string): Observable<Cita> {
    return this.api.put<CitaApiDTO>(`${this.PATH}/${id}`, { estado: 'CANCELADA_PACIENTE', motivoCancelacion: motivo }).pipe(map(d => this.mapDTO(d)));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getModalidades(): string[] {
    return ['PRESENCIAL', 'VIRTUAL', 'DOMICILIO'];
  }

  private buildBody(req: CrearCitaLocalRequest): Record<string, unknown> {
    const fin = new Date(req.fecha_inicio);
    fin.setMinutes(fin.getMinutes() + req.duracion_minutos);
    // Campos camelCase — coinciden exactamente con los fields de la entidad Cita
    const body: Record<string, unknown> = {
      fechaInicio:         this.toLocalDateTime(req.fecha_inicio),
      fechaFin:            this.toLocalDateTime(fin),
      duracionMinutos:     req.duracion_minutos,
      notasPrevias:        req.notas_previas ?? req.observacion ?? null,
      recordatorioEnviado: req.recordatorio_enviado ?? false,
    };
    // @ManyToOne — siempre como { id } para que Hibernate resuelva la FK
    if (req.terapeuta_id)  body['terapeuta']  = { id: req.terapeuta_id };
    if (req.paciente_id)   body['paciente']   = { id: req.paciente_id };
    if (req.sesion_id)     body['sesion']     = { id: req.sesion_id };
    if (req.estado_id)     body['estado']     = { id: req.estado_id };
    if (req.modalidad_id)  body['modalidad']  = { id: req.modalidad_id };
    // El tipo de terapia se identifica por su key (TipoTerapia.id ES la key del catalogo).
    // Sin esto el PUT respondia OK pero el cambio de tipo se perdia en silencio.
    if (req.tipo_key) body['tipoTerapiaKey'] = req.tipo_key;
    if (req.tipo_recurrencia) body['tipoRecurrencia'] = req.tipo_recurrencia;
    if (req.precio != null) body['precio'] = req.precio;
    return body;
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
      estado:              dto.estado ?? 'PROGRAMADA',
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
      observacion:         dto.observacion ?? dto.notas_previas,
      estado_pago_key:     dto.estado_pago_key,
      estado_pago_nombre:  dto.estado_pago_nombre,
      estado_pago_color:   dto.estado_pago_color,
      tipo_recurrencia:    (dto.tipo_recurrencia as Cita['tipo_recurrencia']) ?? 'EVENTUAL',
      precio:              dto.precio ?? null,
      monto_pagado:        dto.monto_pagado ?? 0,
      numero_sesion:       dto.numero_sesion ?? null,
      total_sesiones:      dto.total_sesiones ?? null,
      tratamiento_id:      dto.tratamiento_id ?? null,
      tratamiento_nombre:  dto.tratamiento_nombre ?? null,
      metodo_pago_nombre:  dto.metodo_pago_nombre ?? null,
      lote_masivo_id:      dto.lote_masivo_id ?? null,
      usuario_creacion_nombre: dto.usuario_creacion_nombre ?? null,
    };
  }

  private toISOLocal(d: Date): string {
    return d.toISOString().slice(0, 19);
  }

  private toLocalDateTime(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
