import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TratamientoService } from '../../Services/tratamiento.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Tratamiento, TratamientoForm, Sesion, tratamientoPaciente, tratamientoTerapeuta } from '../../Models/tratamiento.model';
import { Paciente } from '../../../pacientes/Models/paciente.model';
import { CatalogItem } from '../../../../core/models/catalog.model';

@Component({
  selector: 'app-lista-tratamientos',
  templateUrl: './lista-tratamientos.component.html',
  styleUrls: ['./lista-tratamientos.component.css']
})
export class ListaTratamientosComponent implements OnInit {

  tratamientos: Tratamiento[] = [];
  filtrados: Tratamiento[] = [];
  loading = false;
  guardando = false;
  eliminando = false;

  busqueda = '';
  filtroEstado = '';

  modalAbierto = false;
  editando: Tratamiento | null = null;
  formData: TratamientoForm = this.emptyForm();

  tratamientoAEliminar: Tratamiento | null = null;
  modalEliminar = false;

  // ── Filas expandibles ────────────────────────────────────────────────────
  expandidas: Record<number, boolean> = {};
  sesionesMap: Record<number, Sesion[]> = {};
  cargandoSes: Record<number, boolean> = {};

  // ── Edit modal - última sesión ────────────────────────────────────────────
  ultimaSesionFecha: string | null = null;
  cargandoUltimaSesion = false;

  pacientes: Paciente[] = [];
  terapeutasDropdown: { id: number; nombre: string }[] = [];
  tiposTerapia: CatalogItem[] = [];
  estadosTratamiento: CatalogItem[] = [];
  areas: CatalogItem[] = [];

  // ── Buscador de paciente ─────────────────────────────────────────────────
  pacienteBusqueda = '';
  pacienteDropdownAbierto = false;

  // ── Área (filtra tipo de terapia) + buscador de tipo de terapia ─────────
  fAreaId: number | null = null;
  tipoBusqueda = '';
  tipoDropdownAbierto = false;

  get total() { return this.tratamientos.length; }
  pacienteNombre = tratamientoPaciente;
  terapeutaNombre = tratamientoTerapeuta;

  constructor(
    private tratamientoService: TratamientoService,
    private pacienteService: PacienteService,
    private terapeutaService: TerapeutaService,
    private catalogService: CatalogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.pacienteService.getAll().subscribe(d => this.pacientes = d);
    this.terapeutaService.getParaDropdown().subscribe(d => this.terapeutasDropdown = d);
    this.catalogService.getTiposTerapia().subscribe(d => this.tiposTerapia = d);
    this.catalogService.getEstadosTratamiento().subscribe(d => this.estadosTratamiento = d);
    this.catalogService.getAreas().subscribe(d => this.areas = d);
  }

  // ── Buscador de paciente ─────────────────────────────────────────────────

  get pacientesFiltrados(): Paciente[] {
    const q = this.pacienteBusqueda.toLowerCase().trim();
    const lista = !q ? this.pacientes : this.pacientes.filter(p =>
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
      (p.dni || '').toLowerCase().includes(q)
    );
    return lista.slice(0, 30);
  }

  abrirPacienteDropdown(): void { this.pacienteDropdownAbierto = true; }
  cerrarPacienteDropdownDiferido(): void { setTimeout(() => this.pacienteDropdownAbierto = false, 150); }

  seleccionarPaciente(p: Paciente): void {
    this.formData.pacienteId = p.id ?? null;
    this.pacienteBusqueda = `${p.nombre} ${p.apellido}`;
    this.pacienteDropdownAbierto = false;
  }

  // ── Área → Tipo de terapia (cascada + buscador) ──────────────────────────

  get tiposDeArea(): CatalogItem[] {
    const porArea = this.fAreaId == null
      ? this.tiposTerapia
      : this.tiposTerapia.filter(t => t.area?.id === this.fAreaId);
    const q = this.tipoBusqueda.toLowerCase().trim();
    return !q ? porArea : porArea.filter(t => t.nombre.toLowerCase().includes(q));
  }

  onAreaChange(): void {
    this.formData.tipoTerapiaId = null;
    this.tipoBusqueda = '';
  }

  abrirTipoDropdown(): void { this.tipoDropdownAbierto = true; }
  cerrarTipoDropdownDiferido(): void { setTimeout(() => this.tipoDropdownAbierto = false, 150); }

  seleccionarTipo(t: CatalogItem): void {
    this.formData.tipoTerapiaId = t.id;
    this.tipoBusqueda = t.nombre;
    this.tipoDropdownAbierto = false;
  }

  cargar(): void {
    this.loading = true;
    this.tratamientoService.getAll().subscribe({
      next: data => { this.tratamientos = data; this.filtrar(); this.loading = false; },
      error: ()   => { this.loading = false; }
    });
  }

  filtrar(): void {
    const q = this.busqueda.toLowerCase().trim();
    this.filtrados = this.tratamientos.filter(t => {
      const pac = tratamientoPaciente(t).toLowerCase();
      const ter = tratamientoTerapeuta(t).toLowerCase();
      const matchQ = !q || pac.includes(q) || ter.includes(q) ||
        (t.tipoTerapiaNombre || '').toLowerCase().includes(q);
      const matchEst = !this.filtroEstado ||
        (t.estadoKey || '') === this.filtroEstado;
      return matchQ && matchEst;
    });
  }

  abrirNuevo(): void {
    this.editando = null;
    this.formData = this.emptyForm();
    this.pacienteBusqueda = '';
    this.tipoBusqueda = '';
    this.fAreaId = null;
    this.modalAbierto = true;
  }

  abrirEditar(t: Tratamiento): void {
    this.editando = t;
    const tipo = this.tiposTerapia.find(tt => tt.key === t.tipoTerapiaKey) ?? null;
    this.formData = {
      pacienteId:          t.pacienteId ?? null,
      terapeutaId:         t.terapeutaId ?? null,
      tipoTerapiaId:       tipo?.id ?? null,
      estadoTratamientoId: this.estadosTratamiento.find(e => e.key === t.estadoKey)?.id ?? null,
      fechaInicio:         t.fechaInicio || '',
      sesionesTotal:       t.totalSesiones   ?? null,
      precioPorSesion:     t.precioPorSesion ?? null,
      notas:               t.notas          || '',
      activo:              t.activo         ?? true,
    };
    this.pacienteBusqueda = `${t.pacienteNombre ?? ''} ${t.pacienteApellido ?? ''}`.trim();
    this.fAreaId = tipo?.area?.id ?? null;
    this.tipoBusqueda = tipo?.nombre ?? '';
    this.ultimaSesionFecha = null;
    this.modalAbierto = true;

    const id = t.id!;
    if (this.sesionesMap[id]) {
      this.ultimaSesionFecha = this.computeUltimaSesion(this.sesionesMap[id]);
    } else {
      this.cargandoUltimaSesion = true;
      this.tratamientoService.getSesiones(id).subscribe({
        next: ses => {
          this.sesionesMap[id] = ses;
          this.ultimaSesionFecha = this.computeUltimaSesion(ses);
          this.cargandoUltimaSesion = false;
        },
        error: () => { this.cargandoUltimaSesion = false; }
      });
    }
  }

  private computeUltimaSesion(sesiones: Sesion[]): string | null {
    const ms = sesiones
      .filter(s => s.citaActiva?.fechaInicio)
      .map(s => new Date(s.citaActiva!.fechaInicio).getTime());
    if (!ms.length) return null;
    return new Date(Math.max(...ms)).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  cerrarModal(): void { this.modalAbierto = false; }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardando = true;
    const body = this.buildBody();
    const esEdicion = !!this.editando;
    const op$ = esEdicion
      ? this.tratamientoService.update(this.editando!.id!, body)
      : this.tratamientoService.create(body);
    op$.subscribe({
      next: () => {
        this.toast.success(esEdicion ? 'Paquete actualizado correctamente' : 'Paquete creado correctamente');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => { this.toast.error('Error al guardar el paquete'); this.guardando = false; }
    });
  }

  abrirEliminar(t: Tratamiento): void { this.tratamientoAEliminar = t; this.modalEliminar = true; }
  cerrarEliminar(): void { this.modalEliminar = false; this.tratamientoAEliminar = null; }

  eliminar(): void {
    if (!this.tratamientoAEliminar?.id) return;
    this.eliminando = true;
    this.tratamientoService.delete(this.tratamientoAEliminar.id).subscribe({
      next: () => {
        this.toast.success('Paquete eliminado correctamente');
        this.cerrarEliminar(); this.cargar(); this.eliminando = false;
      },
      error: () => { this.toast.error('Error al eliminar el paquete'); this.eliminando = false; }
    });
  }

  toggleExpansion(id: number): void {
    this.expandidas[id] = !this.expandidas[id];
    if (this.expandidas[id] && !this.sesionesMap[id]) {
      this.cargandoSes[id] = true;
      this.tratamientoService.getSesiones(id).subscribe({
        next: s  => { this.sesionesMap[id] = s;  this.cargandoSes[id] = false; },
        error: () => { this.cargandoSes[id] = false; }
      });
    }
  }

  getPagoColor(key?: string): string {
    if (key === 'PAGADA')  return '#22c55e';
    if (key === 'PARCIAL') return '#f59e0b';
    return '#94a3b8';
  }

  getProgreso(t: Tratamiento): number {
    const total = t.totalSesiones ?? 0;
    const comp  = t.sesionesAtendidas ?? 0;
    return total > 0 ? Math.min(100, Math.round((comp / total) * 100)) : 0;
  }

  private emptyForm(): TratamientoForm {
    return { pacienteId: null, terapeutaId: null, tipoTerapiaId: null,
             estadoTratamientoId: null, fechaInicio: '',
             sesionesTotal: null, precioPorSesion: null, notas: '', activo: true };
  }

  private buildBody(): any {
    const f = this.formData;
    return {
      paciente:           f.pacienteId           ? { id: f.pacienteId } as any           : undefined,
      terapeuta:          f.terapeutaId          ? { id: f.terapeutaId } as any          : undefined,
      tipoTerapia:        f.tipoTerapiaId        ? { id: f.tipoTerapiaId } as any        : undefined,
      estadoTratamiento:  f.estadoTratamientoId  ? { id: f.estadoTratamientoId } as any  : undefined,
      fechaInicio:        f.fechaInicio || undefined,
      sesionesTotal:      f.sesionesTotal   ?? undefined,
      precioPorSesion:    f.precioPorSesion ?? undefined,
      notas:              f.notas || undefined,
      activo:             f.activo,
    };
  }
}
