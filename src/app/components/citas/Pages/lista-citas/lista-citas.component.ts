import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CitaService } from '../../Services/cita.service';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { TratamientoService } from '../../../tratamientos/Services/tratamiento.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { AtencionMetrica, METRICAS_DEFAULT } from '../../../atencion-clinica/Models/atencion.model';
import { Cita, CrearCitaConPacienteRequest, CrearCitaLocalRequest, PacienteEnCita, TipoTerapia } from '../../Models/cita.model';
import { Terapeuta, terapeutaNombre } from '../../../terapeutas/Models/terapeuta.model';
import { CatalogItem } from '../../../../core/models/catalog.model';

export interface DiaSemana { nombre: string; fecha: Date; }
export interface Slot { h: number; m: number; lbl: string; }

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

@Component({
  selector: 'app-lista-citas',
  templateUrl: './lista-citas.component.html',
  styleUrls: ['./lista-citas.component.css']
})
export class ListaCitasComponent implements OnInit {

  citas: Cita[] = [];
  loading = true;
  cargandoCatalogos = true;
  guardando = false;

  tiposTerapia: TipoTerapia[] = [];
  estadosCita:  CatalogItem[] = [];
  modalidades:  CatalogItem[] = [];
  metodosPago:  CatalogItem[] = [];

  // ── Terapeutas (objetos completos para filtro por tipo) ────────────────────
  terapeutas: Terapeuta[] = [];
  terapeutasNombres: string[] = [];
  filtrosTerapeutas: string[] = [];
  filtroTipoTerapeuta = '';

  // ── Hover card ────────────────────────────────────────────────────────────
  citaHoverId: string | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  vista: 'semana' | 'libre' = 'semana';
  configVisible = false;

  fechaInicioSemana!: Date;
  diasSemana: DiaSemana[] = [];
  weekLabel = '';
  slots: Slot[] = [];

  modalAbierto = false;
  modoFormulario: 'regular' | 'kids' = 'regular';
  citaEditando: Cita | null = null;

  pac1: PacienteState = this.emptyPac();
  pac2: PacienteState = this.emptyPac();
  pac2habilitado = false;

  fTer = '';
  fTipoId = '';
  fEstKey = '';
  fModalidad = 'PRESENCIAL';
  fFecha = '';       // "YYYY-MM-DD" — reemplaza fDia
  fHoraInicio = '08:00'; // "HH:MM"  — reemplaza fH, fM
  fDur = 45;
  fObs = '';

  // ── Precio / pago ────────────────────────────────────────────────────────
  fPrecio: number | null = null;
  fPagado = false;
  fMetodoPagoId: number | null = null;

  // ── Programación múltiple ─────────────────────────────────────────────────
  modoProgramacion: 'single' | 'multiple' = 'single';
  bulkDias = [true, false, true, false, true, false, false]; // L M X J V S D
  bulkSesiones = 10;
  bulkFechaInicio = '';
  bulkPreview: Date[] = [];
  bulkSesionesAPagar = 10;

  // ── Pago individual de cita ───────────────────────────────────────────────
  citaPagandoId: string | null = null;
  pagoMonto: number | null = null;
  pagoMetodoId: number | null = null;
  pagoTratamientoId: number | null = null;
  pagoSaldoPrevio: number = 0;
  pagoMontoCargando = false;
  guardandoPago = false;

  // ── Atención Clínica ─────────────────────────────────────────────────────
  modalAtencion = false;
  guardandoAtencion = false;
  citaParaAtencion: Cita | null = null;
  atencionNotas = '';
  atencionMetricas: AtencionMetrica[] = [];

  readonly DIAS_NOM = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  readonly DIAS_ABR = ['L','M','X','J','V','S','D'];

  constructor(
    private citaService: CitaService,
    private terapeutaService: TerapeutaService,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private router: Router,
    private atencionService: AtencionClinicaService
  ) {}

  ngOnInit(): void {
    this.generarSlots();
    this.irHoy();
    this.cargarCatalogos();
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get tiposRegulares(): TipoTerapia[] { return this.tiposTerapia.filter(t => t.id !== 'KIDS'); }
  get tipoKids(): TipoTerapia | undefined { return this.tiposTerapia.find(t => t.id === 'KIDS'); }
  get tipoSeleccionado(): TipoTerapia | undefined { return this.tiposTerapia.find(t => t.id === this.fTipoId); }
  get esMultipaciente(): boolean { return (this.tipoSeleccionado?.max_pacientes ?? 1) > 1; }

  get pac1Resumen(): string {
    if (this.pac1.nombre) return `${this.pac1.nombre} ${this.pac1.apellido}`.trim();
    if (this.pac1.dni)    return `DNI: ${this.pac1.dni}`;
    return 'Sin datos';
  }

  get pac2Resumen(): string {
    if (this.pac2.nombre) return `${this.pac2.nombre} ${this.pac2.apellido}`.trim();
    if (this.pac2.dni)    return `DNI: ${this.pac2.dni}`;
    return 'Sin datos';
  }

  get tiposTerapeuta(): string[] {
    const tipos = new Set(this.terapeutas.map(t => t.tipoTerapeuta?.nombre).filter(Boolean));
    return [...tipos] as string[];
  }

  get terapeutasFiltrados(): Terapeuta[] {
    if (!this.filtroTipoTerapeuta) return this.terapeutas;
    return this.terapeutas.filter(t =>
      (t.tipoTerapeuta?.nombre ?? '').toLowerCase().includes(this.filtroTipoTerapeuta.toLowerCase())
    );
  }

  getNombreTerapeuta(t: Terapeuta): string { return terapeutaNombre(t); }

  esTerapeutaSeleccionado(nombre: string): boolean {
    return this.filtrosTerapeutas.includes(nombre);
  }

  // ── Carga de datos ───────────────────────────────────────────────────────────

  private cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    forkJoin({
      tipos:       this.citaService.getTiposTerapiaFromApi(),
      estados:     this.catalogService.getEstadosCita(),
      modalidades: this.catalogService.getModalidades(),
      terapeutas:  this.terapeutaService.getAll(),
      metodosPago: this.catalogService.getMetodosPago().pipe(catchError(() => of([] as CatalogItem[]))),
    }).subscribe({
      next: ({ tipos, estados, modalidades, terapeutas, metodosPago }) => {
        this.tiposTerapia      = tipos;
        this.estadosCita       = estados;
        this.modalidades       = modalidades;
        this.metodosPago       = metodosPago;
        this.terapeutas        = terapeutas;
        this.terapeutasNombres = terapeutas.map(t => terapeutaNombre(t)).filter(Boolean);
        this.fMetodoPagoId     = metodosPago[0]?.id ?? null;
        this.cargandoCatalogos = false;
        this.resetForm();
      },
      error: () => { this.cargandoCatalogos = false; this.resetForm(); }
    });
  }

  // ── Slots — cada 30 min para soportar horarios flexibles ────────────────────

  generarSlots(): void {
    this.slots = [];
    for (let h = 8; h < 20; h++) {
      for (const m of [0, 30]) {
        const lbl = `${String(h).padStart(2,'0')}:${m === 0 ? '00' : '30'}`;
        this.slots.push({ h, m, lbl });
      }
    }
  }

  irHoy(): void {
    const hoy = new Date();
    const dow  = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + (dow === 0 ? -6 : 1 - dow));
    lunes.setHours(0, 0, 0, 0);
    this.fechaInicioSemana = lunes;
    this.construirSemana();
    this.cargarCitas();
  }

  navSemana(dir: -1 | 1): void {
    const d = new Date(this.fechaInicioSemana);
    d.setDate(d.getDate() + dir * 7);
    this.fechaInicioSemana = d;
    this.construirSemana();
    this.cargarCitas();
  }

  construirSemana(): void {
    this.diasSemana = this.DIAS_NOM.map((nombre, i) => {
      const fecha = new Date(this.fechaInicioSemana);
      fecha.setDate(this.fechaInicioSemana.getDate() + i);
      return { nombre, fecha };
    });
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    this.weekLabel = `${this.fechaInicioSemana.toLocaleDateString('es-PE', opts)} – ${this.diasSemana[6].fecha.toLocaleDateString('es-PE', opts)}`;
  }

  cargarCitas(): void {
    this.loading = true;
    this.citaService.getCitas().subscribe({
      next: citas => { this.citas = citas; this.loading = false; },
      error: ()    => { this.loading = false; }
    });
  }

  private recargarSilencioso(): void {
    this.citaService.getCitas().subscribe({ next: citas => { this.citas = citas; } });
  }

  // ── Filtro de terapeutas ────────────────────────────────────────────────────

  toggleFiltroTerapeuta(nombre: string): void {
    const idx = this.filtrosTerapeutas.indexOf(nombre);
    if (idx >= 0) this.filtrosTerapeutas.splice(idx, 1);
    else this.filtrosTerapeutas.push(nombre);
  }

  filtrarPorTipo(tipo: string): void {
    this.filtroTipoTerapeuta = tipo;
    if (!tipo) { this.filtrosTerapeutas = []; return; }
    this.filtrosTerapeutas = this.terapeutas
      .filter(t => (t.tipoTerapeuta?.nombre ?? '') === tipo)
      .map(t => terapeutaNombre(t))
      .filter(Boolean);
  }

  limpiarFiltros(): void {
    this.filtrosTerapeutas = [];
    this.filtroTipoTerapeuta = '';
  }

  // ── Helpers de estado, tipo, chips ─────────────────────────────────────────

  getTipo(id: string): TipoTerapia {
    return this.tiposTerapia.find(t => t.id === id)
      ?? { id, nombre: id, duracion_minutos: 45, max_pacientes: 1 };
  }

  getEstadoColor(key: string): string {
    return this.estadosCita.find(e => e.key === key)?.colorHex ?? '#94a3b8';
  }

  getChipStyle(cita: Cita): Record<string, string> {
    const color = this.getEstadoColor(cita.estado);
    return { 'border-left': `3px solid ${color}`, 'background': `${color}1a` };
  }

  getPagoColor(key?: string): string {
    if (key === 'PAGADA')  return '#22c55e';
    if (key === 'PARCIAL') return '#f59e0b';
    return '#94a3b8'; // SIN_PAGO
  }

  isPagada(cita: Cita): boolean { return cita.estado_pago_key === 'PAGADA'; }
  isParcial(cita: Cita): boolean { return cita.estado_pago_key === 'PARCIAL'; }

  // ── Hover card con delay (evita que se cierre al cruzar el gap de 6px) ────

  enterHover(id: string): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.citaHoverId = id;
  }

  leaveHover(citaId: string): void {
    if (this.citaPagandoId === citaId) return;
    this.hideTimer = setTimeout(() => {
      if (!this.citaPagandoId) this.citaHoverId = null;
      this.hideTimer = null;
    }, 180);
  }

  // ── Pago individual desde hover card ──────────────────────────────────────

  abrirPagoCita(cita: Cita, e: Event): void {
    e.stopPropagation();
    this.citaPagandoId     = cita.id;
    this.pagoMonto         = null;
    this.pagoTratamientoId = null;
    this.pagoSaldoPrevio   = 0;
    this.pagoMetodoId      = this.metodosPago[0]?.id ?? null;
    this.guardandoPago     = false;
    this.pagoMontoCargando = true;

    const pacienteId = Number(cita.paciente_id);
    if (pacienteId) {
      this.tratamientoService.getByPaciente(pacienteId).subscribe({
        next: ts => {
          const t = ts.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
          if (t) {
            this.pagoMonto         = t.precioPorSesion ?? null;
            this.pagoTratamientoId = t.id ?? null;
            this.pagoSaldoPrevio   = t.saldoAFavor ?? 0;
          }
          this.pagoMontoCargando = false;
        },
        error: () => { this.pagoMontoCargando = false; }
      });
    } else {
      this.pagoMontoCargando = false;
    }
  }

  cancelarPagoCita(): void { this.citaPagandoId = null; }

  confirmarPagoCita(cita: Cita): void {
    if (!this.pagoMonto || this.pagoMonto <= 0) {
      this.toast.warning('Ingresa un monto válido'); return;
    }
    if (!this.pagoTratamientoId) {
      this.toast.error('No se encontró tratamiento para este paciente'); return;
    }
    const pacienteId = Number(cita.paciente_id);
    const citaId     = Number(cita.id);
    if (!pacienteId || !citaId) return;

    this.guardandoPago = true;
    const body: any = {
      tratamiento:   { id: this.pagoTratamientoId },
      paciente:      { id: pacienteId },
      cita:          { id: citaId },
      montoRecibido: this.pagoMonto,
      montoAplicado: this.pagoMonto,
      saldoGenerado: 0,
      saldoPrevio:   this.pagoSaldoPrevio,
      notas:         'Pago por cita individual',
    };
    if (this.pagoMetodoId) body.metodo = { id: this.pagoMetodoId };
    this.pagoService.create(body).subscribe({
      next: () => {
        this.toast.success('Pago registrado — cita marcada como pagada');
        this.citaPagandoId = null;
        this.guardandoPago = false;
        this.recargarSilencioso();
      },
      error: () => { this.toast.error('Error al registrar el pago'); this.guardandoPago = false; }
    });
  }

  // ── Slots y vistas ─────────────────────────────────────────────────────────

  getCitasSlot(diaIdx: number, h: number, m: number): Cita[] {
    const fecha = this.diasSemana[diaIdx]?.fecha;
    if (!fecha) return [];
    const slotMin = h * 60 + m;
    return this.citas.filter(c => {
      const ini = new Date(c.fecha_inicio);
      if (ini.getFullYear() !== fecha.getFullYear() ||
          ini.getMonth()    !== fecha.getMonth()    ||
          ini.getDate()     !== fecha.getDate()) return false;
      const citaMin = ini.getHours() * 60 + ini.getMinutes();
      if (citaMin < slotMin || citaMin >= slotMin + 30) return false;
      if (this.filtrosTerapeutas.length > 0 &&
          !this.filtrosTerapeutas.includes(c.terapeuta_nombre ?? '')) return false;
      return true;
    });
  }

  getCitasSlotTer(diaIdx: number, h: number, m: number, terapeuta: string): Cita[] {
    const fecha = this.diasSemana[diaIdx]?.fecha;
    if (!fecha) return [];
    const slotMin = h * 60 + m;
    return this.citas.filter(c => {
      const ini = new Date(c.fecha_inicio);
      if (ini.getFullYear() !== fecha.getFullYear() ||
          ini.getMonth()    !== fecha.getMonth()    ||
          ini.getDate()     !== fecha.getDate()) return false;
      const citaMin = ini.getHours() * 60 + ini.getMinutes();
      if (citaMin < slotMin || citaMin >= slotMin + 30) return false;
      return c.terapeuta_nombre === terapeuta;
    });
  }

  getSlotLibresDia(terapeuta: string, diaIdx: number): { slot: Slot; libre: number }[] {
    return this.slots.map(s => {
      const citasAqui = this.getCitasSlotTer(diaIdx, s.h, s.m, terapeuta);
      const maxPac = citasAqui.length > 0
        ? this.getTipo((citasAqui[0].tipo_terapia_key ?? '').toUpperCase()).max_pacientes
        : 1;
      return { slot: s, libre: Math.max(0, maxPac - citasAqui.length) };
    }).filter(x => x.libre > 0);
  }

  getResumenLibres(): { terapeuta: string; dias: number[]; total: number }[] {
    return this.terapeutasNombres.map(ter => {
      const dias = this.diasSemana.map((_, di) => this.getSlotLibresDia(ter, di).length);
      return { terapeuta: ter, dias, total: dias.reduce((a, b) => a + b, 0) };
    }).sort((a, b) => b.total - a.total);
  }

  getLibresTerapeuta(terapeuta: string): number {
    let libre = 0;
    for (let di = 0; di < 7; di++) libre += this.getSlotLibresDia(terapeuta, di).length;
    return libre;
  }

  esHoy(fecha: Date): boolean {
    const h = new Date();
    return fecha.getDate() === h.getDate() && fecha.getMonth() === h.getMonth() && fecha.getFullYear() === h.getFullYear();
  }

  getDurInfo(): string {
    const tipo = this.tipoSeleccionado;
    if (!tipo) return '';
    return this.esMultipaciente
      ? `${tipo.nombre}: hasta ${tipo.max_pacientes} pacientes simultáneos · ${this.fDur} min`
      : `${tipo.nombre}: duración fija ${tipo.duracion_minutos} min · 1 paciente por slot`;
  }

  onTipoChange(): void {
    const tipo = this.tipoSeleccionado;
    if (tipo && this.esMultipaciente) this.fDur = tipo.duracion_minutos;
  }

  onDuracionTipoChange(tipo: TipoTerapia): void {
    const t = this.tiposTerapia.find(x => x.id === tipo.id);
    if (t) t.duracion_minutos = tipo.duracion_minutos;
    if (this.fTipoId === tipo.id && this.esMultipaciente) this.fDur = tipo.duracion_minutos;
  }

  // ── Búsqueda de paciente por DNI ──────────────────────────────────────────

  buscarDni(pac: PacienteState): void {
    const dni = pac.dni.trim();
    if (!dni) { this.toast.warning('Ingresa un DNI para buscar'); return; }
    pac.buscando = true;
    this.citaService.buscarPorDni(dni).subscribe({
      next: encontrado => {
        pac.buscando = false;
        if (encontrado) {
          pac.id = encontrado.id; pac.nombre = encontrado.nombre;
          pac.apellido = encontrado.apellido; pac.telefono = encontrado.telefono ?? '';
          pac.correo = encontrado.correo ?? ''; pac.modo = 'encontrado'; pac.colapsado = true;
        } else {
          pac.id = null; pac.nombre = ''; pac.apellido = '';
          pac.telefono = ''; pac.correo = ''; pac.modo = 'nuevo';
        }
      },
      error: () => { pac.buscando = false; pac.modo = 'nuevo'; pac.id = null; }
    });
  }

  cambiarPaciente(pac: PacienteState): void {
    pac.modo = 'buscar'; pac.id = null;
    pac.nombre = ''; pac.apellido = ''; pac.telefono = ''; pac.correo = '';
    pac.colapsado = false;
  }

  togglePac(pac: PacienteState): void {
    if (pac.modo !== 'buscar') pac.colapsado = !pac.colapsado;
  }

  // ── Modal ────────────────────────────────────────────────────────────────────

  abrirNueva(): void { this.citaEditando = null; this.resetForm(); this.modalAbierto = true; }

  abrirSlot(diaIdx: number, s: Slot): void {
    this.citaEditando = null; this.resetForm();
    const fecha = this.diasSemana[diaIdx].fecha;
    this.fFecha = this.fechaToISO(fecha);
    this.fHoraInicio = s.lbl;
    this.modalAbierto = true;
  }

  abrirEditar(cita: Cita, e: Event): void {
    e.stopPropagation();
    this.citaEditando = cita;
    const ini = new Date(cita.fecha_inicio);
    this.pac1 = {
      colapsado: true, modo: 'encontrado', buscando: false, id: null,
      dni:      cita.paciente_dni      ?? '',
      nombre:   cita.paciente_nombre   ?? '',
      apellido: cita.paciente_apellido ?? '',
      telefono: cita.paciente_telefono ?? '',
      correo:   cita.paciente_correo   ?? '',
    };
    this.pac2 = this.emptyPac();
    this.pac2habilitado = false;
    this.fTer       = cita.terapeuta_nombre ?? '';
    this.fTipoId    = (cita.tipo_terapia_key ?? '').toUpperCase() || (this.tiposTerapia[0]?.id ?? '');
    this.fEstKey    = cita.estado;
    this.fModalidad = (cita.modalidad as string) || 'PRESENCIAL';
    this.fFecha     = this.fechaToISO(ini);
    this.fHoraInicio = `${String(ini.getHours()).padStart(2,'0')}:${String(ini.getMinutes()).padStart(2,'0')}`;
    this.fDur       = cita.duracion_minutos;
    this.fObs       = cita.observacion ?? cita.notas_previas ?? '';
    this.modoFormulario = this.fTipoId === 'KIDS' ? 'kids' : 'regular';
    this.modoProgramacion = 'single';
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; this.citaEditando = null; }

  resetForm(): void {
    this.pac1 = this.emptyPac();
    this.pac2 = this.emptyPac();
    this.pac2habilitado = false;
    this.fTer    = this.terapeutasNombres[0] ?? '';
    const primerTipo = this.tiposTerapia.find(t => t.id !== 'KIDS') ?? this.tiposTerapia[0];
    this.fTipoId = primerTipo?.id ?? '';
    const hoy = new Date();
    this.fFecha     = this.fechaToISO(hoy);
    this.fHoraInicio = '08:00';
    this.fDur       = primerTipo?.duracion_minutos ?? 45;
    this.fEstKey    = this.estadosCita[0]?.key  ?? 'PROGRAMADA';
    this.fModalidad = this.modalidades[0]?.key  ?? 'PRESENCIAL';
    this.fObs       = '';
    this.fPrecio    = null;
    this.fPagado    = false;
    this.fMetodoPagoId = this.metodosPago[0]?.id ?? null;
    this.modoFormulario   = 'regular';
    this.modoProgramacion = 'single';
    this.bulkDias   = [true, false, true, false, true, false, false];
    this.bulkSesiones        = 10;
    this.bulkFechaInicio     = this.fechaToISO(hoy);
    this.bulkPreview         = [];
    this.bulkSesionesAPagar  = this.bulkSesiones;
    this.calcularBulkDates();
  }

  cambiarModo(m: 'regular' | 'kids'): void {
    this.modoFormulario = m;
    if (m === 'kids') {
      this.fTipoId = this.tipoKids?.id ?? 'KIDS';
      this.pac2habilitado = false;
    } else {
      const regular = this.tiposTerapia.find(t => t.id !== 'KIDS');
      this.fTipoId = regular?.id ?? '';
    }
    this.onTipoChange();
  }

  // ── Programación múltiple ──────────────────────────────────────────────────

  calcularBulkDates(): void {
    this.bulkPreview = [];
    if (!this.bulkFechaInicio || !this.fHoraInicio) return;
    const diasActivos = this.bulkDias.map((v, i) => v ? i : -1).filter(i => i >= 0);
    if (diasActivos.length === 0 || this.bulkSesiones < 1) return;

    const [y, mo, d] = this.bulkFechaInicio.split('-').map(Number);
    const [fH, fM]   = this.fHoraInicio.split(':').map(Number);

    let cursor = new Date(y, mo - 1, d);
    let count = 0;
    let tries = 0;

    while (count < this.bulkSesiones && tries < 366) {
      tries++;
      const dow = (cursor.getDay() + 6) % 7; // 0=Lunes … 6=Domingo
      if (diasActivos.includes(dow)) {
        const date = new Date(cursor);
        date.setHours(fH, fM, 0, 0);
        this.bulkPreview.push(date);
        count++;
      }
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
    if (this.bulkSesionesAPagar > this.bulkPreview.length) {
      this.bulkSesionesAPagar = this.bulkPreview.length;
    }
  }

  // ── Guardar cita ──────────────────────────────────────────────────────────

  guardarCita(): void {
    if (!this.pac1.nombre.trim() || !this.pac1.apellido.trim()) {
      this.toast.warning('Completa los datos del paciente 1'); return;
    }
    if (!this.fTer)    { this.toast.warning('Selecciona un terapeuta');        return; }
    if (!this.fTipoId) { this.toast.warning('Selecciona un tipo de terapia'); return; }
    if (!this.fFecha || !this.fHoraInicio) { this.toast.warning('Selecciona fecha y hora'); return; }

    if (this.modoProgramacion === 'multiple' && !this.citaEditando) {
      this.guardarBulk(); return;
    }

    const tipo = this.tipoSeleccionado!;
    const dur  = this.esMultipaciente ? this.fDur : tipo.duracion_minutos;
    const fechaSlot = this.parseFechaHora(this.fFecha, this.fHoraInicio);
    const fechaFin  = new Date(fechaSlot);
    fechaFin.setMinutes(fechaFin.getMinutes() + dur);

    // Conflicto de capacidad
    const nuevosCount = (this.esMultipaciente && this.pac2habilitado && this.pac2.nombre.trim()) ? 2 : 1;
    const conflictos = this.citas.filter(c => {
      if (c.terapeuta_nombre !== this.fTer) return false;
      if (this.citaEditando && c.id === this.citaEditando.id) return false;
      return fechaSlot < new Date(c.fecha_fin) && fechaFin > new Date(c.fecha_inicio);
    });
    if (conflictos.length + nuevosCount > tipo.max_pacientes) {
      const disponible = tipo.max_pacientes - conflictos.length;
      this.toast.error(disponible <= 0
        ? `Capacidad completa (máx. ${tipo.max_pacientes} pac.)`
        : `Solo hay ${disponible} cupo(s) disponible(s)`);
      return;
    }

    this.guardando = true;

    if (this.citaEditando) {
      const req: CrearCitaLocalRequest = {
        terapeuta_id: Number(this.citaEditando.terapeuta_id) || undefined,
        sesion_id:    this.citaEditando.sesion_id             || undefined,
        estado_id:    this.estadosCita.find(e => e.key === this.fEstKey)?.id,
        modalidad_id: this.modalidades.find(m => m.key === this.fModalidad)?.id,
        fecha_inicio:     fechaSlot,
        duracion_minutos: dur,
        notas_previas:    this.fObs || undefined,
        terapeuta_nombre:  this.fTer,
        tipo_key:          this.fTipoId,
        tipo_nombre:       tipo.nombre,
        estado_key:        this.fEstKey,
        modalidad_key:     this.fModalidad,
        paciente_nombre:   this.pac1.nombre,
        paciente_apellido: this.pac1.apellido,
        paciente_dni:      this.pac1.dni      || undefined,
        paciente_telefono: this.pac1.telefono || undefined,
        paciente_correo:   this.pac1.correo   || undefined,
        observacion:       this.fObs || undefined,
      };
      this.citaService.actualizarCitaLocal(this.citaEditando.id, req).subscribe({
        next: () => {
          this.toast.success('Cita actualizada correctamente');
          this.cerrarModal(); this.recargarSilencioso(); this.guardando = false;
        },
        error: () => { this.toast.error('Error al actualizar la cita'); this.guardando = false; }
      });
    } else {
      const buildPac = (p: PacienteState): PacienteEnCita => ({
        id:       p.id ?? undefined,
        dni:      p.dni,
        nombre:   p.nombre,
        apellido: p.apellido,
        telefono: p.telefono || undefined,
        correo:   p.correo   || undefined,
      });

      const req: CrearCitaConPacienteRequest = {
        paciente:  buildPac(this.pac1),
        paciente2: (this.esMultipaciente && this.pac2habilitado && this.pac2.nombre.trim())
                    ? buildPac(this.pac2) : null,
        terapeutaNombre: this.fTer,
        tipoKey:         this.fTipoId,
        fechaInicio:     this.toLocalDT(fechaSlot),
        duracionMinutos: dur,
        estadoKey:       this.fEstKey,
        modalidadKey:    this.fModalidad,
        observacion:     this.fObs || undefined,
        totalSesionesPlan: 1,
        precioPorSesion:   this.fPrecio ?? 0,
      };

      this.citaService.crearConPaciente(req).subscribe({
        next: (citas) => {
          if (this.fPrecio && this.fPrecio > 0 && this.fPagado && citas.length > 0) {
            const pacienteId = Number(citas[0].paciente_id);
            const citaId     = Number(citas[0].id);
            if (pacienteId) this.crearPagoParaCita(pacienteId, this.fPrecio, this.fMetodoPagoId, citaId);
          }
          this.toast.success('Cita creada correctamente');
          this.cerrarModal(); this.recargarSilencioso(); this.guardando = false;
        },
        error: () => { this.toast.error('Error al crear la cita'); this.guardando = false; }
      });
    }
  }

  private guardarBulk(): void {
    if (this.bulkPreview.length === 0) {
      this.toast.warning('No hay fechas programadas. Selecciona días y fecha de inicio.'); return;
    }

    const tipo = this.tipoSeleccionado!;
    const dur  = this.esMultipaciente ? this.fDur : tipo.duracion_minutos;
    this.guardando = true;

    const buildPac = (p: PacienteState): PacienteEnCita => ({
      id: p.id ?? undefined, dni: p.dni, nombre: p.nombre, apellido: p.apellido,
      telefono: p.telefono || undefined, correo: p.correo || undefined,
    });

    let creadas = 0;
    const total = this.bulkPreview.length;

    const crearSiguiente = (index: number): void => {
      if (index >= total) {
        this.toast.success(`${creadas} de ${total} citas creadas correctamente`);
        this.cerrarModal(); this.recargarSilencioso(); this.guardando = false;
        return;
      }
      const fecha = this.bulkPreview[index];
      const req: CrearCitaConPacienteRequest = {
        paciente:  buildPac(this.pac1),
        paciente2: (this.esMultipaciente && this.pac2habilitado && this.pac2.nombre.trim())
                    ? buildPac(this.pac2) : null,
        terapeutaNombre: this.fTer,
        tipoKey:         this.fTipoId,
        fechaInicio:     this.toLocalDT(fecha),
        duracionMinutos: dur,
        estadoKey:       this.fEstKey,
        modalidadKey:    this.fModalidad,
        observacion:     this.fObs || undefined,
        totalSesionesPlan: total,
        precioPorSesion:   this.fPrecio ?? 0,
      };
      this.citaService.crearConPaciente(req).subscribe({
        next: (citas) => {
          creadas++;
          if (this.fPrecio && this.fPrecio > 0 && index < this.bulkSesionesAPagar && citas.length > 0) {
            const pid    = Number(citas[0].paciente_id);
            const citaId = Number(citas[0].id);
            if (pid) this.crearPagoParaCita(pid, this.fPrecio, this.fMetodoPagoId, citaId);
          }
          crearSiguiente(index + 1);
        },
        error: () => crearSiguiente(index + 1)
      });
    };

    crearSiguiente(0);
  }

  private crearPagoParaCita(pacienteId: number, monto: number, metodoId: number | null, citaId?: number): void {
    this.tratamientoService.getByPaciente(pacienteId).subscribe({
      next: tratamientos => {
        if (tratamientos.length === 0) return;
        const t = tratamientos.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
        const body: any = {
          tratamiento:   { id: t.id },
          paciente:      { id: pacienteId },
          montoRecibido: monto,
          montoAplicado: monto,
          saldoGenerado: 0,
          saldoPrevio:   t.saldoAFavor ?? 0,
          notas:         'Pagado al crear cita',
        };
        if (metodoId) body.metodo = { id: metodoId };
        if (citaId)   body.cita   = { id: citaId };
        this.pagoService.create(body).subscribe({ error: () => {} });
      }
    });
  }

  eliminarCita(): void {
    if (!this.citaEditando) return;
    if (!confirm('¿Eliminar esta cita?')) return;
    this.citaService.eliminarCitaLocal(this.citaEditando.id).subscribe({
      next: () => { this.toast.success('Cita eliminada correctamente'); this.cerrarModal(); this.recargarSilencioso(); },
      error: () => { this.toast.error('Error al eliminar la cita') }
    });
  }

  // ── Atención Clínica ──────────────────────────────────────────────────────

  abrirAtencion(cita: Cita, e: Event): void {
    e.stopPropagation();
    this.citaParaAtencion = cita;
    this.atencionNotas    = cita.notas_previas ?? '';
    this.atencionMetricas = METRICAS_DEFAULT.map(m => ({ ...m }));
    this.modalAtencion    = true;
  }

  cerrarAtencion(): void {
    this.modalAtencion    = false;
    this.citaParaAtencion = null;
    this.atencionNotas    = '';
    this.atencionMetricas = [];
  }

  guardarAtencion(): void {
    if (!this.citaParaAtencion) return;
    this.guardandoAtencion = true;
    const now = new Date().toISOString().slice(0, 19);
    const payload = {
      citaId:          Number(this.citaParaAtencion.id),
      fechaInicioReal: now,
      notasPost:       this.atencionNotas || undefined,
      metricas:        this.atencionMetricas.filter(m => m.valor !== null),
    };
    this.atencionService.crear(payload).subscribe({
      next: () => {
        this.toast.success('Atención registrada correctamente');
        this.cerrarAtencion(); this.recargarSilencioso(); this.guardandoAtencion = false;
      },
      error: () => { this.toast.error('Error al registrar la atención'); this.guardandoAtencion = false; }
    });
  }

  verDetalle(id: string): void { this.router.navigate(['/citas', id]); }

  formatHora(f: Date): string {
    return new Date(f).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  formatFecha(f: Date): string {
    return new Date(f).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  private emptyPac(): PacienteState {
    return { colapsado: false, modo: 'buscar', buscando: false, id: null, dni: '', nombre: '', apellido: '', telefono: '', correo: '' };
  }

  private fechaToISO(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  private parseFechaHora(fecha: string, hora: string): Date {
    const [y, mo, d] = fecha.split('-').map(Number);
    const [h, m]     = hora.split(':').map(Number);
    return new Date(y, mo - 1, d, h, m, 0, 0);
  }

  private toLocalDT(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
