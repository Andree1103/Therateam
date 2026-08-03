import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TerapeutaService, TerapeutaFiltros } from '../../Services/terapeuta.service';
import { TerapeutaHorarioService } from '../../Services/terapeuta-horario.service';
import { TerapeutaExcepcionService } from '../../Services/terapeuta-excepcion.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Terapeuta, TerapeutaForm, TerapeutaCompletoRequest,
  terapeutaNombre, UsuarioBasico
} from '../../Models/terapeuta.model';
import {
  TerapeutaHorario, TerapeutaExcepcion,
  TerapeutaHorarioForm, TerapeutaExcepcionForm,
  DIAS_SEMANA, TIPOS_EXCEPCION, diaNombre
} from '../../Models/terapeuta-horario.model';
import { CatalogItem, Sede } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';

@Component({
  selector: 'app-lista-terapeutas',
  templateUrl: './lista-terapeutas.component.html',
  styleUrls: ['./lista-terapeutas.component.css']
})
export class ListaTerapeutasComponent implements OnInit {

  // ── Lista principal ───────────────────────────────────────────────────────
  terapeutas: Terapeuta[] = [];
  loading = false;
  guardando = false;
  eliminando = false;
  filtroNombre = '';
  filtroCmp = '';
  filtroAreaId: number | null = null;
  filtroActivo = '';

  // ── Paginación server-side ───────────────────────────────────────────────
  readonly tamanioPaginaOpciones = [5, 10, 15, 20];
  paginaActual = 0;
  tamanioPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;

  // ── Modal crear/editar terapeuta ─────────────────────────────────────────
  modalAbierto = false;
  editando: Terapeuta | null = null;
  formData: TerapeutaForm = this.emptyForm();
  usuariosLibres: UsuarioBasico[] = [];
  cargandoUsuarios = false;

  // ── Modal eliminar ────────────────────────────────────────────────────────
  terapeutaAEliminar: Terapeuta | null = null;
  modalEliminar = false;

  // ── Catálogos ─────────────────────────────────────────────────────────────
  sedes: Sede[] = [];
  areas: CatalogItem[] = [];
  especialidades: CatalogItem[] = [];
  turnos: CatalogItem[] = [];

  // ── Modal horario ─────────────────────────────────────────────────────────
  modalHorario = false;
  terapeutaHorarioActual: Terapeuta | null = null;
  horarios: TerapeutaHorario[] = [];
  excepciones: TerapeutaExcepcion[] = [];
  cargandoHorario = false;

  // ── Sub-modal: bloque de horario ──────────────────────────────────────────
  modalBloque = false;
  editandoBloque: TerapeutaHorario | null = null;
  guardandoBloque = false;
  formBloque: TerapeutaHorarioForm = this.emptyFormBloque();

  // ── Sub-modal: excepción ──────────────────────────────────────────────────
  modalExcepcion = false;
  editandoExcepcion: TerapeutaExcepcion | null = null;
  guardandoExcepcion = false;
  formExcepcion: TerapeutaExcepcionForm = this.emptyFormExcepcion();

  // ── Confirm inline ────────────────────────────────────────────────────────
  modalConfirm = false;
  confirmMsg = '';
  confirmFn: (() => void) | null = null;

  // ── Constantes ────────────────────────────────────────────────────────────
  readonly dias = DIAS_SEMANA;
  readonly tiposExcepcion = TIPOS_EXCEPCION;
  nombreCompleto = terapeutaNombre;
  get total() { return this.totalElementos; }

  constructor(
    private terapeutaService: TerapeutaService,
    private horarioService: TerapeutaHorarioService,
    private excepcionService: TerapeutaExcepcionService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private authService: AuthService
  ) {}

  get puedeCrear(): boolean { return this.authService.puedeCrear('TERAPEUTAS'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('TERAPEUTAS'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('TERAPEUTAS'); }

  ngOnInit(): void {
    this.cargar();
    forkJoin({
      sedes:          this.catalogService.getSedes().pipe(catchError(() => of([]))),
      areas:          this.catalogService.getAreas().pipe(catchError(() => of([]))),
      especialidades: this.catalogService.getEspecialidades().pipe(catchError(() => of([]))),
      turnos:         this.catalogService.getTurnos().pipe(catchError(() => of([]))),
    }).subscribe(({ sedes, areas, especialidades, turnos }) => {
      this.sedes          = sedes;
      this.areas          = areas;
      this.especialidades = especialidades;
      this.turnos         = turnos;
    });
  }

  // ── Lista ─────────────────────────────────────────────────────────────────

  cargar(): void {
    this.loading = true;
    const filtros: TerapeutaFiltros = {
      nombre: this.filtroNombre,
      cmp: this.filtroCmp,
      areaId: this.filtroAreaId,
      activo: this.filtroActivo === '' ? null : this.filtroActivo === 'true',
    };
    this.terapeutaService.getAllPaged(this.paginaActual, this.tamanioPagina, filtros).subscribe({
      next: res => {
        this.terapeutas = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /** Los filtros solo se aplican al clic en "Buscar" (o Enter) — nunca mientras se tipea. */
  buscar(): void {
    this.paginaActual = 0;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroNombre = '';
    this.filtroCmp = '';
    this.filtroAreaId = null;
    this.filtroActivo = '';
    this.buscar();
  }

  cambiarTamanioPagina(size: number): void {
    this.tamanioPagina = size;
    this.paginaActual = 0;
    this.cargar();
  }

  irAPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas || p === this.paginaActual) return;
    this.paginaActual = p;
    this.cargar();
  }

  // ── Modal crear/editar terapeuta ──────────────────────────────────────────

  abrirNuevo(): void {
    if (!this.puedeCrear) return;
    this.editando = null;
    this.formData = this.emptyForm();
    this.cargandoUsuarios = true;
    this.terapeutaService.getUsuariosLibres().subscribe({
      next: d => { this.usuariosLibres = d; this.cargandoUsuarios = false; },
      error: () => { this.cargandoUsuarios = false; }
    });
    this.modalAbierto = true;
  }

  abrirEditar(t: Terapeuta): void {
    if (!this.puedeEditar) return;
    // Precargar con datos del DTO para abrir el modal inmediatamente
    this.editando = t;
    this.formData = this.formDataFromTerapeuta(t);
    this.modalAbierto = true;
    // Cargar entidad completa para obtener sedeId del usuario
    this.terapeutaService.getById(t.id!).subscribe({
      next: full => { this.formData = this.formDataFromTerapeuta(full); },
      error: () => { /* fallback ya aplicado */ }
    });
  }

  private formDataFromTerapeuta(t: Terapeuta): TerapeutaForm {
    return {
      modo:               'nuevo',
      usuarioId:          t.usuario?.id ?? null,
      nombre:             t.usuario?.nombre  ?? t.nombre  ?? '',
      apellido:           t.usuario?.apellido ?? t.apellido ?? '',
      email:              t.usuario?.email   ?? t.email   ?? '',
      password:           '',
      sedeId:             t.usuario?.sede?.id ?? null,
      areaId:             t.area?.id ?? null,
      cmp:                t.cmp || '',
      telefono:           t.telefono || '',
      horarioDescripcion: t.horarioDescripcion || '',
      activo:             t.activo ?? true,
      especialidadIds:    (t.especialidades || []).map(e => e.id),
    };
  }

  cerrarModal(): void { this.modalAbierto = false; }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardando = true;
    const body = this.buildCompletoBody();
    const esEdicion = !!this.editando;
    const op$ = esEdicion
      ? this.terapeutaService.updateCompleto(this.editando!.id!, body)
      : this.terapeutaService.createCompleto(body);
    op$.subscribe({
      next: actualizado => {
        this.toast.success(esEdicion ? 'Terapeuta actualizado' : 'Terapeuta creado');
        this.cerrarModal();
        // Editar solo cambia una fila ya visible: se actualiza en el array local en vez de
        // repetir el GET paginado. Crear sí necesita recargar (posición según orden/filtro).
        if (esEdicion) {
          const idx = this.terapeutas.findIndex(t => t.id === actualizado.id);
          if (idx !== -1) this.terapeutas[idx] = actualizado;
        } else {
          this.cargar();
        }
        this.guardando = false;
      },
      error: () => { this.toast.error('Error al guardar el terapeuta'); this.guardando = false; }
    });
  }

  toggleEspecialidad(id: number): void {
    const idx = this.formData.especialidadIds.indexOf(id);
    if (idx === -1) this.formData.especialidadIds.push(id);
    else this.formData.especialidadIds.splice(idx, 1);
  }

  tieneEspecialidad(id: number): boolean {
    return this.formData.especialidadIds.includes(id);
  }

  // ── Modal eliminar ────────────────────────────────────────────────────────

  abrirEliminar(t: Terapeuta): void {
    if (!this.puedeEliminar) return;
    this.terapeutaAEliminar = t; this.modalEliminar = true;
  }
  cerrarEliminar(): void { this.modalEliminar = false; this.terapeutaAEliminar = null; }

  eliminar(): void {
    if (!this.terapeutaAEliminar?.id) return;
    this.eliminando = true;
    const id = this.terapeutaAEliminar.id;
    this.terapeutaService.delete(id).subscribe({
      next: () => {
        this.toast.success('Terapeuta eliminado');
        this.cerrarEliminar(); this.eliminando = false;
        this.terapeutas = this.terapeutas.filter(t => t.id !== id);
        this.totalElementos = Math.max(0, this.totalElementos - 1);
        if (this.terapeutas.length === 0 && this.paginaActual > 0) {
          this.paginaActual--; this.cargar();
        }
      },
      error: () => { this.toast.error('Error al eliminar'); this.eliminando = false; }
    });
  }

  // ── Modal horario (principal) ─────────────────────────────────────────────

  abrirHorario(t: Terapeuta): void {
    this.terapeutaHorarioActual = t;
    this.modalHorario = true;
    this.cargarHorario(t.id!);
  }

  cerrarHorario(): void {
    this.modalHorario = false;
    this.terapeutaHorarioActual = null;
    this.horarios = [];
    this.excepciones = [];
    this.modalBloque = false;
    this.modalExcepcion = false;
  }

  cargarHorario(terapeutaId: number): void {
    this.cargandoHorario = true;
    forkJoin({
      horarios:   this.horarioService.getByTerapeuta(terapeutaId).pipe(catchError(() => of([]))),
      excepciones: this.excepcionService.getByTerapeuta(terapeutaId).pipe(catchError(() => of([]))),
    }).subscribe(({ horarios, excepciones }) => {
      this.horarios    = horarios;
      this.excepciones = excepciones;
      this.cargandoHorario = false;
    });
  }

  horariosDia(dia: number): TerapeutaHorario[] {
    return this.horarios.filter(h => h.diaSemana === dia);
  }

  // ── Rangos de turno ───────────────────────────────────────────────────────

  turnoMin = '';
  turnoMax = '';

  onTurnoChange(newId: number | null): void {
    this.formBloque.turnoId = newId;
    const turno = this.turnos.find(t => t.id === newId);
    if (!turno) { this.turnoMin = ''; this.turnoMax = ''; return; }
    const n = (turno.nombre ?? turno.key ?? '').toLowerCase();
    let inicio = '', fin = '';
    if      (n.includes('mañ') || n.includes('man')) { inicio = '06:00'; fin = '13:00'; }
    else if (n.includes('tard'))                      { inicio = '13:00'; fin = '20:00'; }
    else if (n.includes('noch'))                      { inicio = '20:00'; fin = '23:59'; }
    this.turnoMin = inicio;
    this.turnoMax = fin;
    if (inicio) { this.formBloque.horaInicio = inicio; this.formBloque.horaFin = fin; }
  }

  // ── Sub-modal: bloque ─────────────────────────────────────────────────────

  abrirNuevoBloque(dia?: number): void {
    this.editandoBloque = null;
    this.formBloque = this.emptyFormBloque();
    if (dia) this.formBloque.diaSemana = dia;
    this.onTurnoChange(this.turnos.length ? this.turnos[0].id : null);
    this.modalBloque = true;
  }

  abrirEditarBloque(h: TerapeutaHorario): void {
    this.editandoBloque = h;
    const turnoId = h.turno?.id ?? h.turnoId ?? null;
    this.formBloque = {
      diaSemana:  h.diaSemana,
      turnoId,
      horaInicio: h.horaInicio,
      horaFin:    h.horaFin,
      activo:     h.activo,
    };
    // Inicializar rango visual sin sobreescribir las horas ya guardadas
    const turno = this.turnos.find(t => t.id === turnoId);
    if (turno) {
      const n = (turno.nombre ?? turno.key ?? '').toLowerCase();
      if      (n.includes('mañ') || n.includes('man')) { this.turnoMin = '06:00'; this.turnoMax = '13:00'; }
      else if (n.includes('tard'))                      { this.turnoMin = '13:00'; this.turnoMax = '20:00'; }
      else if (n.includes('noch'))                      { this.turnoMin = '20:00'; this.turnoMax = '23:59'; }
      else { this.turnoMin = ''; this.turnoMax = ''; }
    } else { this.turnoMin = ''; this.turnoMax = ''; }
    this.modalBloque = true;
  }

  cerrarBloque(): void { this.modalBloque = false; this.editandoBloque = null; }

  guardarBloque(): void {
    if (!this.formBloque.diaSemana) { this.toast.warning('Selecciona el día'); return; }
    if (!this.formBloque.turnoId)   { this.toast.warning('Selecciona el turno'); return; }
    if (!this.formBloque.horaInicio || !this.formBloque.horaFin) {
      this.toast.warning('Completa los horarios'); return;
    }
    const id = this.terapeutaHorarioActual!.id!;
    this.guardandoBloque = true;
    const body: Partial<TerapeutaHorario> = {
      terapeuta:  { id },
      diaSemana:  this.formBloque.diaSemana,
      turno:      { id: this.formBloque.turnoId! } as any,
      horaInicio: this.formBloque.horaInicio,
      horaFin:    this.formBloque.horaFin,
      activo:     this.formBloque.activo,
    };
    const op$ = this.editandoBloque
      ? this.horarioService.update(this.editandoBloque.id!, body)
      : this.horarioService.create(body);
    op$.subscribe({
      next: () => {
        this.toast.success(this.editandoBloque ? 'Bloque actualizado' : 'Bloque agregado');
        this.cerrarBloque();
        this.cargarHorario(id);
        this.guardandoBloque = false;
      },
      error: () => { this.toast.error('Error al guardar el bloque'); this.guardandoBloque = false; }
    });
  }

  pedirEliminarBloque(h: TerapeutaHorario): void {
    this.confirmMsg = `¿Eliminar bloque del ${diaNombre(h.diaSemana)} (${h.horaInicio}–${h.horaFin})?`;
    this.confirmFn = () => {
      const id = this.terapeutaHorarioActual!.id!;
      this.horarioService.delete(h.id!).subscribe({
        next: () => { this.toast.success('Bloque eliminado'); this.cargarHorario(id); },
        error: () => this.toast.error('Error al eliminar')
      });
    };
    this.modalConfirm = true;
  }

  // ── Sub-modal: excepción ──────────────────────────────────────────────────

  abrirNuevaExcepcion(): void {
    this.editandoExcepcion = null;
    this.formExcepcion = this.emptyFormExcepcion();
    this.modalExcepcion = true;
  }

  abrirEditarExcepcion(e: TerapeutaExcepcion): void {
    this.editandoExcepcion = e;
    this.formExcepcion = {
      fecha:      e.fecha,
      tipo:       e.tipo,
      horaInicio: e.horaInicio ?? '',
      horaFin:    e.horaFin ?? '',
      motivo:     e.motivo ?? '',
    };
    this.modalExcepcion = true;
  }

  cerrarExcepcion(): void { this.modalExcepcion = false; this.editandoExcepcion = null; }

  guardarExcepcion(): void {
    if (!this.formExcepcion.fecha) { this.toast.warning('Selecciona la fecha'); return; }
    if (this.formExcepcion.tipo !== 'BLOQUEO_TOTAL' &&
        (!this.formExcepcion.horaInicio || !this.formExcepcion.horaFin)) {
      this.toast.warning('Completa las horas'); return;
    }
    const id = this.terapeutaHorarioActual!.id!;
    this.guardandoExcepcion = true;
    const body: Partial<TerapeutaExcepcion> = {
      terapeuta:  { id },
      fecha:      this.formExcepcion.fecha,
      tipo:       this.formExcepcion.tipo,
      horaInicio: this.formExcepcion.tipo !== 'BLOQUEO_TOTAL' ? this.formExcepcion.horaInicio : undefined,
      horaFin:    this.formExcepcion.tipo !== 'BLOQUEO_TOTAL' ? this.formExcepcion.horaFin : undefined,
      motivo:     this.formExcepcion.motivo || undefined,
    };
    const op$ = this.editandoExcepcion
      ? this.excepcionService.update(this.editandoExcepcion.id!, body)
      : this.excepcionService.create(body);
    op$.subscribe({
      next: () => {
        this.toast.success(this.editandoExcepcion ? 'Excepción actualizada' : 'Excepción registrada');
        this.cerrarExcepcion();
        this.cargarHorario(id);
        this.guardandoExcepcion = false;
      },
      error: () => { this.toast.error('Error al guardar la excepción'); this.guardandoExcepcion = false; }
    });
  }

  pedirEliminarExcepcion(e: TerapeutaExcepcion): void {
    this.confirmMsg = `¿Eliminar la excepción del ${this.formatFechaCorta(e.fecha)}?`;
    this.confirmFn = () => {
      const id = this.terapeutaHorarioActual!.id!;
      this.excepcionService.delete(e.id!).subscribe({
        next: () => { this.toast.success('Excepción eliminada'); this.cargarHorario(id); },
        error: () => this.toast.error('Error al eliminar')
      });
    };
    this.modalConfirm = true;
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  confirmar(): void { this.confirmFn?.(); this.modalConfirm = false; this.confirmFn = null; }
  cancelarConfirm(): void { this.modalConfirm = false; this.confirmFn = null; }

  // ── Helpers ───────────────────────────────────────────────────────────────

  iniciales(t: Terapeuta): string {
    const n = terapeutaNombre(t);
    const parts = n.split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  usuarioNombre(u: UsuarioBasico): string { return `${u.nombre} ${u.apellido}`; }

  turnoNombre(h: TerapeutaHorario): string {
    return h.turno?.nombre ?? this.turnos.find(t => t.id === h.turnoId)?.nombre ?? 'Turno';
  }

  /** mañana=1, tarde=2, noche=3 — según el nombre del turno. 0 si no se reconoce. */
  turnoNivel(h: TerapeutaHorario): number {
    const n = this.turnoNombre(h).toLowerCase();
    if (n.includes('mañ') || n.includes('man'))  return 1;
    if (n.includes('tard'))                       return 2;
    if (n.includes('noch'))                       return 3;
    return 0;
  }

  /** Clase CSS del bloque según su turno, para el color-coding (verde/azul/naranja). */
  turnoClase(h: TerapeutaHorario): string {
    switch (this.turnoNivel(h)) {
      case 1: return 'h-bloque--manana';
      case 2: return 'h-bloque--tarde';
      case 3: return 'h-bloque--noche';
      default: return '';
    }
  }

  tipoLabel(tipo: string): string {
    return this.tiposExcepcion.find(t => t.value === tipo)?.label ?? tipo;
  }

  tipoColor(tipo: string): string {
    return tipo === 'BLOQUEO_TOTAL'   ? '#ef4444'
         : tipo === 'BLOQUEO_PARCIAL' ? '#f97316'
         : '#22c55e';
  }

  diaNombre(n: number): string { return diaNombre(n); }

  formatFechaCorta(f?: string): string {
    if (!f) return '—';
    const [y, m, d] = f.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Builders privados ─────────────────────────────────────────────────────

  private emptyForm(): TerapeutaForm {
    return {
      modo: 'existente', usuarioId: null,
      nombre: '', apellido: '', email: '', password: '', sedeId: null,
      areaId: null, cmp: '', telefono: '',
      horarioDescripcion: '', activo: true, especialidadIds: []
    };
  }

  private emptyFormBloque(): TerapeutaHorarioForm {
    return { diaSemana: null, turnoId: null, horaInicio: '08:00', horaFin: '13:00', activo: true };
  }

  private emptyFormExcepcion(): TerapeutaExcepcionForm {
    return { fecha: '', tipo: 'BLOQUEO_TOTAL', horaInicio: '', horaFin: '', motivo: '' };
  }

  private buildCompletoBody(): TerapeutaCompletoRequest {
    const f = this.formData;
    const modo: 'existente' | 'nuevo' = this.editando ? 'nuevo' : f.modo;
    const base: TerapeutaCompletoRequest = {
      modo,
      areaId:             f.areaId || null,
      cmp:                f.cmp || undefined,
      telefono:           f.telefono || undefined,
      horarioDescripcion: f.horarioDescripcion || undefined,
      activo:             f.activo,
      especialidadIds:    f.especialidadIds,
      sedeId:             f.sedeId || null,
    };
    if (modo === 'existente') {
      base.usuarioId = f.usuarioId!;
    } else {
      base.nombre   = f.nombre;
      base.apellido = f.apellido;
      base.email    = f.email;
      if (f.password) base.password = f.password;
    }
    return base;
  }
}
