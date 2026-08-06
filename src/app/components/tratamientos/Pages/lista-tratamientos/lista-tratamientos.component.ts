import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TratamientoService, TratamientoFiltros } from '../../Services/tratamiento.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Tratamiento, TratamientoForm, Sesion, tratamientoPaciente, tratamientoTerapeuta } from '../../Models/tratamiento.model';
export interface PacienteState {
  colapsado: boolean;
  modo: 'buscar' | 'encontrado' | 'nuevo';
  buscando: boolean;
  id: number | null;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string;
  correo: string;
}
import { Terapeuta, terapeutaNombre as nombreDeTerapeuta } from '../../../terapeutas/Models/terapeuta.model';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';

@Component({
  selector: 'app-lista-tratamientos',
  templateUrl: './lista-tratamientos.component.html',
  styleUrls: ['./lista-tratamientos.component.css']
})
export class ListaTratamientosComponent implements OnInit {

  tratamientos: Tratamiento[] = [];
  loading = false;
  guardando = false;
  eliminando = false;

  filtroPaciente = '';
  filtroTerapeuta = '';
  filtroTipoTerapiaId: number | null = null;
  filtroEstado = '';

  // ── Paginación server-side ───────────────────────────────────────────────
  readonly tamanioPaginaOpciones = [5, 10, 15, 20];
  paginaActual = 0;
  tamanioPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;

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

  terapeutasTodos: Terapeuta[] = [];
  tiposTerapia: CatalogItem[] = [];
  estadosTratamiento: CatalogItem[] = [];
  especialidades: CatalogItem[] = [];
  areas: CatalogItem[] = [];
  plantillas: CatalogItem[] = [];
  plantillaSeleccionadaId: number | null = null;

  // ── Paciente por DNI (igual que en Citas): buscar → encontrado / nuevo ────
  pac: PacienteState = this.emptyPac();

  // ── Buscador de plantilla del catálogo ────────────────────────────────────
  plantillaBusqueda = '';
  plantillaDropdownAbierto = false;

  // ── Cascada (igual que Citas): Área → Tipo de terapia → Terapeuta ─────────
  fAreaId: number | null = null;
  fEspecialidadId: number | null = null;
  tipoBusqueda = '';
  tipoDropdownAbierto = false;
  nombreDeTerapeuta = nombreDeTerapeuta;

  // ── Pago inicial (solo al crear): pendiente / pagado completo / adelanto ──
  pagoModo: 'pendiente' | 'completo' | 'parcial' = 'pendiente';
  pagoMonto: number | null = null;
  pagoMetodoId: number | null = null;
  metodosPago: CatalogItem[] = [];

  get montoTotalPaquete(): number {
    return (this.formData.sesionesTotal ?? 0) * (this.formData.precioPorSesion ?? 0);
  }

  get total() { return this.totalElementos; }
  pacienteNombre = tratamientoPaciente;
  terapeutaNombre = tratamientoTerapeuta;

  constructor(
    private tratamientoService: TratamientoService,
    private pacienteService: PacienteService,
    private terapeutaService: TerapeutaService,
    private pagoService: PagoService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private authService: AuthService
  ) {}

  get puedeCrear(): boolean { return this.authService.puedeCrear('PAQUETES'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('PAQUETES'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('PAQUETES'); }

  ngOnInit(): void {
    this.cargar();
    this.terapeutaService.getAll().subscribe(d => this.terapeutasTodos = d);
    this.catalogService.getTiposTerapia().subscribe(d => this.tiposTerapia = d);
    this.catalogService.getEstadosTratamiento().subscribe(d => this.estadosTratamiento = d);
    this.catalogService.getEspecialidades().subscribe(d => this.especialidades = d);
    this.catalogService.getAreas().subscribe(d => this.areas = d);
    this.catalogService.getMetodosPago().subscribe(d => this.metodosPago = d);
    this.catalogService.getPlantillasPaquete().subscribe(d => this.plantillas = d.filter(p => p.activo !== false));
  }

  /**
   * Autocompleta sesiones/precio desde el catálogo — sigue siendo editable después. La plantilla
   * también trae su propia área (y opcionalmente tipo de terapia), así que se autocompleta toda
   * la cascada (área → tipo de terapia → terapeutas filtrados), igual que al elegirla a mano.
   */
  onPlantillaChange(): void {
    const p = this.plantillas.find(x => x.id === this.plantillaSeleccionadaId);
    if (!p) return;
    this.formData.sesionesTotal = p.totalSesiones ?? this.formData.sesionesTotal;
    if (p.precioTotal != null && p.totalSesiones) {
      this.formData.precioPorSesion = Math.round((p.precioTotal / p.totalSesiones) * 100) / 100;
    }
    if (!this.formData.notas) this.formData.notas = p.nombre;
    if (p.area?.id) {
      this.fAreaId = p.area.id;
    } else if (p.tipoTerapia?.area?.id) {
      this.fAreaId = p.tipoTerapia.area.id;
    }
    if (p.tipoTerapia?.id) {
      const tipoCompleto = this.tiposTerapia.find(t => t.id === p.tipoTerapia!.id);
      if (tipoCompleto) this.seleccionarTipo(tipoCompleto);
    } else {
      this.formData.tipoTerapiaId = null;
      this.tipoBusqueda = '';
    }
  }

  // ── Buscador de plantilla del catálogo (autocompletar sesiones/precio) ───

  get plantillasFiltradas(): CatalogItem[] {
    const q = this.plantillaBusqueda.toLowerCase().trim();
    const lista = !q ? this.plantillas : this.plantillas.filter(p =>
      p.nombre.toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q)
    );
    return lista.slice(0, 30);
  }

  abrirPlantillaDropdown(): void { this.plantillaDropdownAbierto = true; }
  cerrarPlantillaDropdownDiferido(): void { setTimeout(() => this.plantillaDropdownAbierto = false, 150); }

  seleccionarPlantilla(p: CatalogItem): void {
    this.plantillaSeleccionadaId = p.id;
    this.plantillaBusqueda = p.nombre;
    this.plantillaDropdownAbierto = false;
    this.onPlantillaChange();
  }

  limpiarPlantilla(): void {
    this.plantillaSeleccionadaId = null;
    this.plantillaBusqueda = '';
  }

  // ── Paciente por DNI: busca uno existente o deja capturar uno nuevo ──────

  private emptyPac(): PacienteState {
    return { colapsado: false, modo: 'buscar', buscando: false, id: null,
             dni: '', nombre: '', apellido: '', telefono: '', correo: '' };
  }

  buscarDni(): void {
    const dni = this.pac.dni.trim();
    if (!dni) { this.toast.warning('Ingresa un DNI para buscar'); return; }
    this.pac.buscando = true;
    this.pacienteService.buscarPorDni(dni).subscribe({
      next: encontrado => {
        this.pac.buscando = false;
        if (encontrado) {
          this.pac.id = encontrado.id ?? null;
          this.pac.nombre = encontrado.nombre;
          this.pac.apellido = encontrado.apellido;
          this.pac.telefono = encontrado.telefono ?? '';
          this.pac.correo = encontrado.correo ?? '';
          this.pac.modo = 'encontrado';
          this.formData.pacienteId = this.pac.id;
        } else {
          this.pac.id = null; this.pac.nombre = ''; this.pac.apellido = '';
          this.pac.telefono = ''; this.pac.correo = '';
          this.pac.modo = 'nuevo';
          this.formData.pacienteId = null;
        }
      },
      error: () => { this.pac.buscando = false; this.pac.modo = 'nuevo'; this.pac.id = null; }
    });
  }

  cambiarPaciente(): void {
    this.pac = this.emptyPac();
    this.formData.pacienteId = null;
  }

  // ── Área → Tipo de terapia → Terapeuta (igual que en Citas) ──────────────

  /** Tipos de terapia del área elegida (si hay) + lo que se esté buscando en el autocompletar. */
  get tiposFiltrados(): CatalogItem[] {
    const porArea = this.fAreaId == null
      ? this.tiposTerapia
      : this.tiposTerapia.filter(t => t.area?.id === this.fAreaId);
    const q = this.tipoBusqueda.toLowerCase().trim();
    return !q ? porArea : porArea.filter(t => t.nombre.toLowerCase().includes(q));
  }

  get tipoSeleccionado(): CatalogItem | null {
    return this.tiposTerapia.find(t => t.id === this.formData.tipoTerapiaId) ?? null;
  }

  /** Solo terapeutas del área elegida — si aún no hay área, se ven todos. */
  get terapeutasFiltrados(): Terapeuta[] {
    return this.fAreaId == null ? this.terapeutasTodos : this.terapeutasTodos.filter(t => t.area?.id === this.fAreaId);
  }

  onAreaChange(): void {
    this.formData.tipoTerapiaId = null;
    this.tipoBusqueda = '';
    this.formData.terapeutaId = null;
  }

  abrirTipoDropdown(): void { this.tipoDropdownAbierto = true; }
  cerrarTipoDropdownDiferido(): void { setTimeout(() => this.tipoDropdownAbierto = false, 150); }

  seleccionarTipo(t: CatalogItem): void {
    this.formData.tipoTerapiaId = t.id;
    this.tipoBusqueda = t.nombre;
    this.tipoDropdownAbierto = false;
    // Refleja la especialidad y área de este tipo, aunque haya llegado por catálogo (elegido a
    // mano o autocompletado) — el área si acaba de quedar vacía o no calza con la del tipo.
    this.fEspecialidadId = t.especialidad?.id ?? this.fEspecialidadId;
    if (t.area?.id != null) this.fAreaId = t.area.id;
    // El terapeuta ya elegido puede no pertenecer a la nueva área — se limpia para forzar re-selección.
    const terapeutaActual = this.terapeutasTodos.find(x => x.id === this.formData.terapeutaId);
    if (terapeutaActual && terapeutaActual.area?.id !== t.area?.id) {
      this.formData.terapeutaId = null;
    }
  }

  cargar(): void {
    this.loading = true;
    const filtros: TratamientoFiltros = {
      paciente: this.filtroPaciente,
      terapeuta: this.filtroTerapeuta,
      tipoTerapiaId: this.filtroTipoTerapiaId,
      estado: this.filtroEstado,
    };
    this.tratamientoService.getAllPaged(this.paginaActual, this.tamanioPagina, filtros).subscribe({
      next: res => {
        this.tratamientos = res.content;
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
    this.filtroPaciente = '';
    this.filtroTerapeuta = '';
    this.filtroTipoTerapiaId = null;
    this.filtroEstado = '';
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
    this.editando = null;
    this.formData = this.emptyForm();
    this.formData.estadoTratamientoId = this.estadosTratamiento.find(e => e.key === 'ACTIVO')?.id ?? null;
    this.pac = this.emptyPac();
    this.tipoBusqueda = '';
    this.fAreaId = null;
    this.fEspecialidadId = null;
    this.plantillaSeleccionadaId = null;
    this.plantillaBusqueda = '';
    this.pagoModo = 'pendiente';
    this.pagoMonto = null;
    this.pagoMetodoId = null;
    this.modalAbierto = true;
  }

  abrirEditar(t: Tratamiento): void {
    if (!this.puedeEditar) return;
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
    this.pac = {
      colapsado: true, modo: 'encontrado', buscando: false,
      id: t.pacienteId ?? null,
      nombre: t.pacienteNombre ?? '',
      apellido: t.pacienteApellido ?? '',
      dni: t.pacienteDni ?? '',
      telefono: t.pacienteTelefono ?? '',
      correo: '',
    };
    this.fEspecialidadId = tipo?.especialidad?.id ?? null;
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
    if (this.pac.modo === 'nuevo') {
      if (!this.pac.nombre || !this.pac.apellido || !this.pac.dni || !this.pac.correo) {
        this.toast.warning('Completa nombre, apellido, DNI y correo del paciente nuevo'); return;
      }
      this.guardando = true;
      const { nombre, apellido, dni, telefono, correo } = this.pac;
      this.pacienteService.create({ nombre, apellido, dni, telefono, correo }).subscribe({
        next: creado => {
          this.pac.id = creado.id ?? null;
          this.pac.modo = 'encontrado';
          this.formData.pacienteId = creado.id ?? null;
          this.guardarTratamiento();
        },
        error: () => { this.toast.error('Error al crear el paciente'); this.guardando = false; }
      });
      return;
    }
    this.guardarTratamiento();
  }

  private guardarTratamiento(): void {
    this.guardando = true;
    const body = this.buildBody();
    const esEdicion = !!this.editando;
    const op$ = esEdicion
      ? this.tratamientoService.update(this.editando!.id!, body)
      : this.tratamientoService.create(body);
    op$.subscribe({
      next: creado => {
        if (!esEdicion && this.pagoModo !== 'pendiente') {
          this.registrarPagoInicial(creado);
          return;
        }
        this.toast.success(esEdicion ? 'Paquete actualizado correctamente' : 'Paquete creado correctamente');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => { this.toast.error('Error al guardar el paquete'); this.guardando = false; }
    });
  }

  /** Registra el pago inicial elegido en el modal contra el paquete recién creado — el paquete
   *  ya quedó guardado, así que un fallo aquí no debe bloquear el flujo, solo avisar. */
  private registrarPagoInicial(paquete: Tratamiento): void {
    const monto = this.pagoModo === 'completo' ? this.montoTotalPaquete : (this.pagoMonto ?? 0);
    this.pagoService.create({
      tratamiento: { id: paquete.id! } as any,
      paciente: { id: this.formData.pacienteId! } as any,
      metodo: { id: this.pagoMetodoId! } as any,
      montoRecibido: monto,
    }).subscribe({
      next: () => {
        this.toast.success('Paquete creado y pago registrado correctamente');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => {
        this.toast.warning('El paquete se creó, pero el pago no se pudo registrar — regístralo desde Pagos.');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      }
    });
  }

  abrirEliminar(t: Tratamiento): void {
    if (!this.puedeEliminar) return;
    this.tratamientoAEliminar = t; this.modalEliminar = true;
  }
  cerrarEliminar(): void { this.modalEliminar = false; this.tratamientoAEliminar = null; }

  eliminar(): void {
    if (!this.tratamientoAEliminar?.id) return;
    this.eliminando = true;
    const id = this.tratamientoAEliminar.id;
    this.tratamientoService.delete(id).subscribe({
      next: () => {
        this.toast.success('Paquete eliminado correctamente');
        this.cerrarEliminar(); this.eliminando = false;
        this.tratamientos = this.tratamientos.filter(t => t.id !== id);
        this.totalElementos = Math.max(0, this.totalElementos - 1);
        if (this.tratamientos.length === 0 && this.paginaActual > 0) {
          this.paginaActual--; this.cargar();
        }
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

  /** El backend exige un nombre (columna NOT NULL) pero el formulario no tiene ese campo — se
   *  arma a partir del tipo de terapia y el paciente, igual que el resumen que ya se muestra en el listado. */
  private nombrePaquete(): string {
    const tipo = this.tipoSeleccionado?.nombre;
    const paciente = `${this.pac.nombre} ${this.pac.apellido}`.trim();
    if (tipo && paciente) return `${tipo} — ${paciente}`;
    return tipo || paciente || 'Paquete';
  }

  private buildBody(): any {
    const f = this.formData;
    return {
      paciente:           f.pacienteId           ? { id: f.pacienteId } as any           : undefined,
      terapeuta:          f.terapeutaId          ? { id: f.terapeutaId } as any          : undefined,
      tipoTerapia:        f.tipoTerapiaId        ? { id: f.tipoTerapiaId } as any        : undefined,
      estado:             f.estadoTratamientoId  ? { id: f.estadoTratamientoId } as any  : undefined,
      nombre:             this.nombrePaquete(),
      fechaInicio:        f.fechaInicio || undefined,
      totalSesiones:      f.sesionesTotal   ?? undefined,
      precioPorSesion:    f.precioPorSesion ?? undefined,
      notas:              f.notas || undefined,
      activo:             f.activo,
    };
  }
}
