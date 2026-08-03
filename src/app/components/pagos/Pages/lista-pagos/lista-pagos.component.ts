import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { PagoService, PagoFiltros } from '../../Services/pago.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Pago, PagoForm, TratamientoBasico } from '../../Models/pago.model';
import { Paciente } from '../../../pacientes/Models/paciente.model';
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
  metodosPago: CatalogItem[] = [];

  get total() { return this.totalElementos; }

  get tratamientoSeleccionado(): TratamientoBasico | null {
    return this.tratamientos.find(t => t.id === this.formData.tratamientoId) ?? null;
  }

  /** Lo que falta para cubrir el paquete completo (monto total - ya cobrado - saldo a favor disponible). */
  get restantePaquete(): number {
    const t = this.tratamientoSeleccionado;
    if (!t) return 0;
    const restante = (t.montoTotal ?? 0) - (t.totalCobrado ?? 0) - (t.saldoAFavor ?? 0);
    return Math.max(0, restante);
  }

  usarMontoPaquete(): void {
    this.formData.montoRecibido = this.restantePaquete;
  }

  constructor(
    private pagoService: PagoService,
    private pacienteService: PacienteService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private authService: AuthService
  ) {}

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
    this.tratamientos = [];
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; }

  onPacienteChange(): void {
    this.formData.tratamientoId = null;
    this.tratamientos = [];
    if (!this.formData.pacienteId) return;
    this.cargandoTratamientos = true;
    this.pagoService.getTratamientosByPaciente(this.formData.pacienteId).subscribe({
      next: data => { this.tratamientos = data; this.cargandoTratamientos = false; },
      error: ()   => { this.cargandoTratamientos = false; }
    });
  }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardando = true;
    const f = this.formData;
    const body: Partial<Pago> = {
      paciente:   f.pacienteId    ? { id: f.pacienteId }    as any : undefined,
      tratamiento: f.tratamientoId ? { id: f.tratamientoId } as any : undefined,
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
    const hoy = new Date().toISOString().slice(0, 16);
    return { pacienteId: null, tratamientoId: null, metodoId: null,
             montoRecibido: null, referencia: '', notas: '', fechaPago: hoy };
  }
}
