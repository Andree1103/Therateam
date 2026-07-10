import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TerapeutaService } from '../../Services/terapeuta.service';
import { TerapeutaHorarioService } from '../../Services/terapeuta-horario.service';
import { TerapeutaExcepcionService } from '../../Services/terapeuta-excepcion.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Terapeuta, terapeutaNombre } from '../../Models/terapeuta.model';
import {
  TerapeutaHorario, TerapeutaExcepcion,
  TerapeutaHorarioForm, TerapeutaExcepcionForm,
  DIAS_SEMANA, TIPOS_EXCEPCION, diaNombre
} from '../../Models/terapeuta-horario.model';
import { CatalogItem } from '../../../../core/models/catalog.model';

@Component({
  selector: 'app-horario-terapeuta',
  templateUrl: './horario-terapeuta.component.html',
  styleUrls: ['./horario-terapeuta.component.css']
})
export class HorarioTerapeutaComponent implements OnInit {

  // ── Datos base ────────────────────────────────────────────────────────────
  terapeutas: Terapeuta[] = [];
  turnos: CatalogItem[] = [];
  loading = true;
  cargandoHorario = false;

  // ── Terapeuta seleccionado ────────────────────────────────────────────────
  terapeutaIdSeleccionado: number | null = null;
  terapeutaActual: Terapeuta | null = null;
  horarios: TerapeutaHorario[] = [];
  excepciones: TerapeutaExcepcion[] = [];

  // ── Vista de horario ──────────────────────────────────────────────────────
  readonly dias = DIAS_SEMANA;
  readonly tiposExcepcion = TIPOS_EXCEPCION;

  // ── Modal horario ─────────────────────────────────────────────────────────
  modalHorario = false;
  editandoHorario: TerapeutaHorario | null = null;
  guardandoHorario = false;
  formHorario: TerapeutaHorarioForm = this.emptyFormHorario();

  // ── Modal excepcion ───────────────────────────────────────────────────────
  modalExcepcion = false;
  editandoExcepcion: TerapeutaExcepcion | null = null;
  guardandoExcepcion = false;
  formExcepcion: TerapeutaExcepcionForm = this.emptyFormExcepcion();

  // ── Confirm eliminar ──────────────────────────────────────────────────────
  modalConfirm = false;
  confirmMsg = '';
  confirmFn: (() => void) | null = null;

  constructor(
    private terapeutaService: TerapeutaService,
    private horarioService: TerapeutaHorarioService,
    private excepcionService: TerapeutaExcepcionService,
    private catalogService: CatalogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    forkJoin({
      terapeutas: this.terapeutaService.getAll().pipe(catchError(() => of([]))),
      turnos: this.catalogService.getTurnos().pipe(catchError(() => of([]))),
    }).subscribe(({ terapeutas, turnos }) => {
      this.terapeutas = terapeutas;
      this.turnos = turnos;
      this.loading = false;
    });
  }

  // ── Selección de terapeuta ────────────────────────────────────────────────

  onTerapeutaChange(): void {
    const id = this.terapeutaIdSeleccionado ? Number(this.terapeutaIdSeleccionado) : null;
    if (!id) { this.terapeutaActual = null; this.horarios = []; this.excepciones = []; return; }
    this.terapeutaActual = this.terapeutas.find(t => t.id === id) ?? null;
    this.cargarHorario(id);
  }

  cargarHorario(id: number): void {
    this.cargandoHorario = true;
    forkJoin({
      horarios: this.horarioService.getByTerapeuta(id).pipe(catchError(() => of([]))),
      excepciones: this.excepcionService.getByTerapeuta(id).pipe(catchError(() => of([]))),
    }).subscribe(({ horarios, excepciones }) => {
      this.horarios = horarios;
      this.excepciones = excepciones;
      this.cargandoHorario = false;
    });
  }

  // ── Horarios por día (para la grilla) ────────────────────────────────────

  horariosDia(dia: number): TerapeutaHorario[] {
    return this.horarios.filter(h => h.diaSemana === dia && h.activo !== false);
  }

  horariosDiaInactivos(dia: number): TerapeutaHorario[] {
    return this.horarios.filter(h => h.diaSemana === dia && h.activo === false);
  }

  get totalBloques(): number { return this.horarios.length; }
  get totalExcepciones(): number { return this.excepciones.length; }

  // ── Modal horario ─────────────────────────────────────────────────────────

  abrirNuevoHorario(dia?: number): void {
    this.editandoHorario = null;
    this.formHorario = this.emptyFormHorario();
    if (dia) this.formHorario.diaSemana = dia;
    if (this.turnos.length) this.formHorario.turnoId = this.turnos[0].id;
    this.modalHorario = true;
  }

  abrirEditarHorario(h: TerapeutaHorario): void {
    this.editandoHorario = h;
    this.formHorario = {
      diaSemana: h.diaSemana,
      turnoId: h.turno?.id ?? h.turnoId ?? null,
      horaInicio: h.horaInicio ?? '',
      horaFin: h.horaFin ?? '',
      activo: h.activo,
    };
    this.modalHorario = true;
  }

  cerrarModalHorario(): void {
    this.modalHorario = false;
    this.editandoHorario = null;
  }

  guardarHorario(): void {
    if (!this.formHorario.diaSemana) { this.toast.warning('Selecciona el día'); return; }
    if (!this.formHorario.turnoId)   { this.toast.warning('Selecciona el turno'); return; }
    if (!this.formHorario.horaInicio || !this.formHorario.horaFin) {
      this.toast.warning('Completa los horarios de inicio y fin'); return;
    }
    const id = this.terapeutaIdSeleccionado ? Number(this.terapeutaIdSeleccionado) : null;
    if (!id) return;

    this.guardandoHorario = true;
    const body: Partial<TerapeutaHorario> = {
      terapeuta:   { id },
      diaSemana:   this.formHorario.diaSemana,
      turno:       { id: this.formHorario.turnoId! } as any,
      horaInicio:  this.formHorario.horaInicio,
      horaFin:     this.formHorario.horaFin,
      activo:      this.formHorario.activo,
    };

    const op$ = this.editandoHorario
      ? this.horarioService.update(this.editandoHorario.id!, body)
      : this.horarioService.create(body);

    op$.subscribe({
      next: () => {
        this.toast.success(this.editandoHorario ? 'Horario actualizado' : 'Horario agregado');
        this.cerrarModalHorario();
        this.cargarHorario(id);
        this.guardandoHorario = false;
      },
      error: () => {
        this.toast.error('Error al guardar el horario');
        this.guardandoHorario = false;
      }
    });
  }

  eliminarHorario(h: TerapeutaHorario): void {
    this.confirmMsg = `¿Eliminar el bloque del ${diaNombre(h.diaSemana)} (${h.horaInicio}–${h.horaFin})?`;
    this.confirmFn = () => {
      const id = Number(this.terapeutaIdSeleccionado);
      this.horarioService.delete(h.id!).subscribe({
        next: () => { this.toast.success('Bloque eliminado'); this.cargarHorario(id); },
        error: () => this.toast.error('Error al eliminar')
      });
    };
    this.modalConfirm = true;
  }

  // ── Modal excepcion ───────────────────────────────────────────────────────

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

  cerrarModalExcepcion(): void {
    this.modalExcepcion = false;
    this.editandoExcepcion = null;
  }

  guardarExcepcion(): void {
    if (!this.formExcepcion.fecha) { this.toast.warning('Selecciona la fecha'); return; }
    if (this.formExcepcion.tipo !== 'BLOQUEO_TOTAL') {
      if (!this.formExcepcion.horaInicio || !this.formExcepcion.horaFin) {
        this.toast.warning('Completa las horas de inicio y fin'); return;
      }
    }
    const id = this.terapeutaIdSeleccionado ? Number(this.terapeutaIdSeleccionado) : null;
    if (!id) return;

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
        this.cerrarModalExcepcion();
        this.cargarHorario(id);
        this.guardandoExcepcion = false;
      },
      error: () => {
        this.toast.error('Error al guardar la excepción');
        this.guardandoExcepcion = false;
      }
    });
  }

  eliminarExcepcion(e: TerapeutaExcepcion): void {
    this.confirmMsg = `¿Eliminar la excepción del ${this.formatFechaCorta(e.fecha)}?`;
    this.confirmFn = () => {
      const id = Number(this.terapeutaIdSeleccionado);
      this.excepcionService.delete(e.id!).subscribe({
        next: () => { this.toast.success('Excepción eliminada'); this.cargarHorario(id); },
        error: () => this.toast.error('Error al eliminar')
      });
    };
    this.modalConfirm = true;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  confirmar(): void {
    this.confirmFn?.();
    this.modalConfirm = false;
    this.confirmFn = null;
  }

  cancelarConfirm(): void {
    this.modalConfirm = false;
    this.confirmFn = null;
  }

  nombreTerapeuta(t: Terapeuta): string { return terapeutaNombre(t); }
  diaNombre(n: number): string { return diaNombre(n); }

  tipoLabel(tipo: string): string {
    return this.tiposExcepcion.find(t => t.value === tipo)?.label ?? tipo;
  }

  tipoColor(tipo: string): string {
    return tipo === 'BLOQUEO_TOTAL' ? '#ef4444'
         : tipo === 'BLOQUEO_PARCIAL' ? '#f97316'
         : '#22c55e';
  }

  formatFechaCorta(f?: string): string {
    if (!f) return '—';
    const [y, m, d] = f.split('-');
    return new Date(+y, +m - 1, +d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  turnoNombre(h: TerapeutaHorario): string {
    return h.turno?.nombre ?? this.turnos.find(t => t.id === h.turnoId)?.nombre ?? 'Turno';
  }

  // ── Formularios vacíos ────────────────────────────────────────────────────

  private emptyFormHorario(): TerapeutaHorarioForm {
    return { diaSemana: null, turnoId: null, horaInicio: '08:00', horaFin: '13:00', activo: true };
  }

  private emptyFormExcepcion(): TerapeutaExcepcionForm {
    return { fecha: '', tipo: 'BLOQUEO_TOTAL', horaInicio: '', horaFin: '', motivo: '' };
  }
}
