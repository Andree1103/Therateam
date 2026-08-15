import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { PagoService, PagoFiltros } from '../../Services/pago.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { CitaService } from '../../../citas/Services/cita.service';
import { TratamientoService } from '../../../tratamientos/Services/tratamiento.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { Pago, PagoForm, TratamientoBasico } from '../../Models/pago.model';
import { Paciente } from '../../../pacientes/Models/paciente.model';
import { Cita } from '../../../citas/Models/cita.model';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';

@Component({
  selector: 'app-lista-pagos',
  templateUrl: './lista-pagos.component.html',
  styleUrls: ['./lista-pagos.component.css']
})
export class ListaPagosComponent implements OnInit {

  pagos: Pago[] = [];
  loading = false;
  guardando = false;
  eliminando = false;
  cargandoTratamientos = false;

  filtroPaciente = '';
  filtroReferencia = '';
  filtroMetodoId: number | null = null;
  filtroTienePaquete = '';   // '' | 'true' | 'false'
  filtroMontoMin: number | null = null;
  filtroMontoMax: number | null = null;
  filtroFechaDesde = '';     // yyyy-MM-dd (input date)
  filtroFechaHasta = '';

  // ── Paginación server-side ───────────────────────────────────────────────
  readonly tamanioPaginaOpciones = [5, 10, 15, 20];
  paginaActual = 0;
  tamanioPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;

  modalAbierto = false;
  formData: PagoForm = this.emptyForm();

  pagoAEliminar: Pago | null = null;
  modalEliminar = false;

  pacientes: Paciente[] = [];
  tratamientos: TratamientoBasico[] = [];
  citasPendientes: Cita[] = [];
  cargandoCitas = false;
  metodosPago: CatalogItem[] = [];

  // ── Sesiones faltantes del paquete elegido (evita cobrar contra citas que no existen) ────
  sesionesCreadasTratamiento: number | null = null;
  cargandoSesionesTratamiento = false;

  // ── Buscador de paciente (por nombre o DNI) ───────────────────────────────
  pacienteBusqueda = '';
  pacienteDropdownAbierto = false;

  get total() { return this.totalElementos; }

  get pacienteSeleccionado(): Paciente | null {
    return this.pacientes.find(p => p.id === this.formData.pacienteId) ?? null;
  }

  get pacientesFiltrados(): Paciente[] {
    const q = this.pacienteBusqueda.toLowerCase().trim();
    if (!q) return this.pacientes.slice(0, 30);
    return this.pacientes.filter(p =>
      `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) || (p.dni || '').includes(q)
    ).slice(0, 30);
  }

  get tratamientoSeleccionado(): TratamientoBasico | null {
    return this.tratamientos.find(t => t.id === this.formData.tratamientoId) ?? null;
  }

  get citaSeleccionada(): Cita | null {
    if (this.formData.citaId == null) return null;
    return this.citasPendientes.find(c => String(c.id) === String(this.formData.citaId)) ?? null;
  }

  /** Lo que falta para cubrir el paquete completo (monto total - ya cobrado - saldo a favor disponible). */
  get restantePaquete(): number {
    const t = this.tratamientoSeleccionado;
    if (!t) return 0;
    const restante = (t.montoTotal ?? 0) - (t.totalCobrado ?? 0) - (t.saldoAFavor ?? 0);
    return Math.max(0, restante);
  }

  /** Lo que falta para cubrir el precio de la cita suelta seleccionada. */
  get restanteCita(): number {
    const c = this.citaSeleccionada;
    if (!c) return 0;
    return Math.max(0, (c.precio ?? 0) - (c.monto_pagado ?? 0));
  }

  usarMontoPaquete(): void {
    this.formData.montoRecibido = this.restantePaquete;
  }

  usarMontoCita(): void {
    this.formData.montoRecibido = this.restanteCita;
  }

  exportando = false;

  constructor(
    private pagoService: PagoService,
    private pacienteService: PacienteService,
    private citaService: CitaService,
    private tratamientoService: TratamientoService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private authService: AuthService,
    private excelExportService: ExcelExportService
  ) {}

  /** Exporta TODOS los pagos que cumplen los filtros activos (no solo la página visible). */
  exportarExcel(): void {
    this.exportando = true;
    const filtros: PagoFiltros = {
      paciente: this.filtroPaciente,
      referencia: this.filtroReferencia,
      metodoId: this.filtroMetodoId,
      tienePaquete: this.filtroTienePaquete === '' ? null : this.filtroTienePaquete === 'true',
      montoMin: this.filtroMontoMin,
      montoMax: this.filtroMontoMax,
      fechaInicio: this.filtroFechaDesde ? `${this.filtroFechaDesde}T00:00:00` : undefined,
      fechaFin: this.filtroFechaHasta ? `${this.filtroFechaHasta}T23:59:59` : undefined,
    };
    this.pagoService.getAllPaged(0, 10000, filtros).subscribe({
      next: res => {
        this.exportando = false;
        if (res.content.length === 0) { this.toast.warning('No hay pagos para exportar con los filtros actuales'); return; }
        const filas = res.content.map(p => ({
          'Fecha': p.fechaPago ? new Date(p.fechaPago).toLocaleString('es-PE') : '',
          'Paciente': p.paciente ? `${p.paciente.nombre} ${p.paciente.apellido}` : '',
          'DNI': p.paciente?.dni ?? '',
          'Paquete': p.tratamiento?.nombre ?? '',
          'Terapeuta': p.tratamiento?.terapeutaNombre ?? '',
          'Tipo': p.tratamiento?.tipoTerapiaNombre ?? '',
          'Método de pago': p.metodo?.nombre ?? '',
          'Monto recibido (S/)': p.montoRecibido ?? '',
          'Monto aplicado (S/)': p.montoAplicado ?? '',
          'Saldo generado (S/)': p.saldoGenerado ?? '',
          'Referencia': p.referencia ?? '',
          'Notas': p.notas ?? '',
        }));
        this.excelExportService.exportar(filas, 'pagos');
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar pagos'); }
    });
  }

  /** Cuántas sesiones del paquete elegido todavía no tienen cita creada — pagar contra una
   *  sesión que no existe generaría un cobro sin cita real que lo respalde. */
  get sesionesFaltantesTratamiento(): number {
    const t = this.tratamientoSeleccionado;
    if (!t || this.sesionesCreadasTratamiento == null) return 0;
    return Math.max(0, (t.totalSesiones ?? 0) - this.sesionesCreadasTratamiento);
  }

  get puedeCrear(): boolean { return this.authService.puedeCrear('PAGOS'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('PAGOS'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('PAGOS'); }

  ngOnInit(): void {
    this.cargar();
    this.pacienteService.getAll().subscribe(d => this.pacientes = d);
    this.catalogService.getMetodosPago().subscribe(d => this.metodosPago = d);
  }

  cargar(): void {
    this.loading = true;
    const filtros: PagoFiltros = {
      paciente: this.filtroPaciente,
      referencia: this.filtroReferencia,
      metodoId: this.filtroMetodoId,
      tienePaquete: this.filtroTienePaquete === '' ? null : this.filtroTienePaquete === 'true',
      montoMin: this.filtroMontoMin,
      montoMax: this.filtroMontoMax,
      fechaInicio: this.filtroFechaDesde ? `${this.filtroFechaDesde}T00:00:00` : undefined,
      fechaFin: this.filtroFechaHasta ? `${this.filtroFechaHasta}T23:59:59` : undefined,
    };
    this.pagoService.getAllPaged(this.paginaActual, this.tamanioPagina, filtros).subscribe({
      next: res => {
        this.pagos = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /** Los filtros solo se aplican al clic en "Buscar" (o Enter) — nunca mientras se tipea/selecciona. */
  buscar(): void {
    this.paginaActual = 0;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroPaciente = '';
    this.filtroReferencia = '';
    this.filtroMetodoId = null;
    this.filtroTienePaquete = '';
    this.filtroMontoMin = null;
    this.filtroMontoMax = null;
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
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

  abrirNuevo(): void {
    if (!this.puedeCrear) return;
    this.formData = this.emptyForm();
    this.pacienteBusqueda = '';
    this.tratamientos = [];
    this.citasPendientes = [];
    this.sesionesCreadasTratamiento = null;
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; }

  // ── Buscador de paciente ──────────────────────────────────────────────────
  abrirPacienteDropdown(): void { this.pacienteDropdownAbierto = true; }
  cerrarPacienteDropdownDiferido(): void { setTimeout(() => this.pacienteDropdownAbierto = false, 150); }

  seleccionarPaciente(p: Paciente): void {
    this.formData.pacienteId = p.id ?? null;
    this.pacienteBusqueda = this.pacienteNombre(p);
    this.pacienteDropdownAbierto = false;
    this.onPacienteChange();
  }

  limpiarPaciente(): void {
    this.formData.pacienteId = null;
    this.pacienteBusqueda = '';
    this.onPacienteChange();
  }

  /** Al elegir el paciente se cargan, en paralelo, sus paquetes pendientes y sus citas
   *  individuales (sin paquete) pendientes de pago — se puede pagar cualquiera de los dos. */
  onPacienteChange(): void {
    this.formData.tratamientoId = null;
    this.formData.citaId = null;
    this.tratamientos = [];
    this.citasPendientes = [];
    if (!this.formData.pacienteId) return;

    this.cargandoTratamientos = true;
    this.pagoService.getTratamientosByPaciente(this.formData.pacienteId).subscribe({
      next: data => { this.tratamientos = data; this.cargandoTratamientos = false; },
      error: ()   => { this.cargandoTratamientos = false; }
    });

    this.cargandoCitas = true;
    this.citaService.getByPaciente(this.formData.pacienteId).subscribe({
      next: data => {
        this.citasPendientes = data.filter(c => !c.tratamiento_id && c.estado_pago_key !== 'PAGADA' && (c.precio ?? 0) > 0);
        this.cargandoCitas = false;
      },
      error: () => { this.cargandoCitas = false; }
    });
  }

  /** Selecciona un paquete como concepto del pago — limpia la cita elegida, son excluyentes.
   *  Se pide fresco cuántas sesiones ya tienen cita creada, para poder avisar si el paquete
   *  tiene sesiones sin agendar todavía (pagarlas sin cita generaría una inconsistencia). */
  onTratamientoChange(): void {
    this.sesionesCreadasTratamiento = null;
    if (!this.formData.tratamientoId) return;
    this.formData.citaId = null;
    this.cargandoSesionesTratamiento = true;
    this.tratamientoService.getSesiones(this.formData.tratamientoId).subscribe({
      next: ses => {
        this.sesionesCreadasTratamiento = ses.filter(s => s.citaActiva).length;
        this.cargandoSesionesTratamiento = false;
      },
      error: () => { this.cargandoSesionesTratamiento = false; }
    });
  }

  /** Selecciona una cita suelta como concepto del pago — limpia el paquete elegido (son excluyentes)
   *  y autocompleta el monto con lo que falta pagar de esa cita, ya editable después. */
  onCitaChange(): void {
    if (!this.formData.citaId) return;
    this.formData.tratamientoId = null;
    this.formData.montoRecibido = this.restanteCita;
  }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    if (this.formData.tratamientoId && this.sesionesFaltantesTratamiento > 0) {
      this.toast.warning(`Este paquete tiene ${this.sesionesFaltantesTratamiento} sesión(es) sin cita creada — complétalas primero desde el paquete antes de registrar el pago.`);
      return;
    }
    this.guardando = true;
    const f = this.formData;
    const body: Partial<Pago> = {
      paciente:   f.pacienteId    ? { id: f.pacienteId }    as any : undefined,
      tratamiento: f.tratamientoId ? { id: f.tratamientoId } as any : undefined,
      cita:       f.citaId        ? { id: f.citaId }        as any : undefined,
      metodo:     f.metodoId      ? { id: f.metodoId }      as any : undefined,
      montoRecibido: f.montoRecibido ?? undefined,
      referencia: f.referencia  || undefined,
      notas:      f.notas       || undefined,
      fechaPago:  f.fechaPago   || undefined,
    };
    this.pagoService.create(body).subscribe({
      next: () => {
        this.toast.success('Pago registrado correctamente');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => { this.toast.error('Error al registrar el pago'); this.guardando = false; }
    });
  }

  abrirEliminar(p: Pago): void {
    if (!this.puedeEliminar) return;
    this.pagoAEliminar = p;
    this.modalEliminar = true;
  }

  cerrarEliminar(): void { this.modalEliminar = false; this.pagoAEliminar = null; }

  eliminar(): void {
    if (!this.pagoAEliminar?.id) return;
    this.eliminando = true;
    const id = this.pagoAEliminar.id;
    this.pagoService.delete(id).subscribe({
      next: () => {
        this.toast.success('Pago eliminado correctamente');
        this.cerrarEliminar(); this.eliminando = false;
        this.pagos = this.pagos.filter(p => p.id !== id);
        this.totalElementos = Math.max(0, this.totalElementos - 1);
        if (this.pagos.length === 0 && this.paginaActual > 0) {
          this.paginaActual--; this.cargar();
        }
      },
      error: () => { this.toast.error('Error al eliminar el pago'); this.eliminando = false; }
    });
  }

  pacienteNombre(p: Paciente): string {
    return `${p.nombre} ${p.apellido}`;
  }

  private emptyForm(): PagoForm {
    return { pacienteId: null, tratamientoId: null, citaId: null, metodoId: null,
             montoRecibido: null, referencia: '', notas: '', fechaPago: this.ahoraLocalISO() };
  }

  /** Fecha/hora actual en formato local (no UTC) para un input datetime-local — usar
   *  toISOString() aquí adelanta la hora según el huso horario del navegador/servidor. */
  private ahoraLocalISO(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
