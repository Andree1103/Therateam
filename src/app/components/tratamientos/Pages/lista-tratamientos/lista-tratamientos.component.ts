import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TratamientoService } from '../../Services/tratamiento.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Tratamiento, TratamientoForm, tratamientoPaciente, tratamientoTerapeuta } from '../../Models/tratamiento.model';
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

  pacientes: Paciente[] = [];
  terapeutasDropdown: { id: number; nombre: string }[] = [];
  tiposTerapia: CatalogItem[] = [];
  estadosTratamiento: CatalogItem[] = [];

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
        (t.tipoTerapia?.nombre || '').toLowerCase().includes(q);
      const matchEst = !this.filtroEstado ||
        (t.estadoTratamiento?.key || '') === this.filtroEstado;
      return matchQ && matchEst;
    });
  }

  abrirNuevo(): void {
    this.editando = null;
    this.formData = this.emptyForm();
    this.modalAbierto = true;
  }

  abrirEditar(t: Tratamiento): void {
    this.editando = t;
    this.formData = {
      pacienteId:          t.paciente?.id         ?? null,
      terapeutaId:         t.terapeuta?.id        ?? null,
      tipoTerapiaId:       t.tipoTerapia?.id      ?? null,
      estadoTratamientoId: t.estadoTratamiento?.id ?? null,
      fechaInicio:         t.fechaInicio          || '',
      fechaFin:            t.fechaFin             || '',
      sesionesTotal:       t.sesionesTotal        ?? null,
      precioPorSesion:     t.precioPorSesion      ?? null,
      notas:               t.notas               || '',
      activo:              t.activo              ?? true,
    };
    this.modalAbierto = true;
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
        this.toast.success(esEdicion ? 'Tratamiento actualizado correctamente' : 'Tratamiento creado correctamente');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => { this.toast.error('Error al guardar el tratamiento'); this.guardando = false; }
    });
  }

  abrirEliminar(t: Tratamiento): void { this.tratamientoAEliminar = t; this.modalEliminar = true; }
  cerrarEliminar(): void { this.modalEliminar = false; this.tratamientoAEliminar = null; }

  eliminar(): void {
    if (!this.tratamientoAEliminar?.id) return;
    this.eliminando = true;
    this.tratamientoService.delete(this.tratamientoAEliminar.id).subscribe({
      next: () => {
        this.toast.success('Tratamiento eliminado correctamente');
        this.cerrarEliminar(); this.cargar(); this.eliminando = false;
      },
      error: () => { this.toast.error('Error al eliminar el tratamiento'); this.eliminando = false; }
    });
  }

  private emptyForm(): TratamientoForm {
    return { pacienteId: null, terapeutaId: null, tipoTerapiaId: null,
             estadoTratamientoId: null, fechaInicio: '', fechaFin: '',
             sesionesTotal: null, precioPorSesion: null, notas: '', activo: true };
  }

  private buildBody(): Partial<Tratamiento> {
    const f = this.formData;
    return {
      paciente:           f.pacienteId           ? { id: f.pacienteId } as any           : undefined,
      terapeuta:          f.terapeutaId          ? { id: f.terapeutaId } as any          : undefined,
      tipoTerapia:        f.tipoTerapiaId        ? { id: f.tipoTerapiaId } as any        : undefined,
      estadoTratamiento:  f.estadoTratamientoId  ? { id: f.estadoTratamientoId } as any  : undefined,
      fechaInicio:        f.fechaInicio || undefined,
      fechaFin:           f.fechaFin    || undefined,
      sesionesTotal:      f.sesionesTotal   ?? undefined,
      precioPorSesion:    f.precioPorSesion ?? undefined,
      notas:              f.notas || undefined,
      activo:             f.activo,
    };
  }
}
