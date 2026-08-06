import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CitaService } from '../../Services/cita.service';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { TratamientoService } from '../../../tratamientos/Services/tratamiento.service';
import { Tratamiento, TratamientoCobertura } from '../../../tratamientos/Models/tratamiento.model';
import { PagoService } from '../../../pagos/Services/pago.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { AtencionMetrica, METRICAS_DEFAULT } from '../../../atencion-clinica/Models/atencion.model';
import { Cita, CrearCitaConPacienteRequest, CrearCitaLocalRequest, PacienteEnCita, TipoTerapia } from '../../Models/cita.model';
import { Terapeuta, terapeutaNombre } from '../../../terapeutas/Models/terapeuta.model';
import { DisponibilidadDia } from '../../../terapeutas/Models/disponibilidad.model';
import { DisponibilidadService } from '../../../terapeutas/Services/disponibilidad.service';
import { TerapeutaHorario } from '../../../terapeutas/Models/terapeuta-horario.model';
import { TerapeutaHorarioService } from '../../../terapeutas/Services/terapeuta-horario.service';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';

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

  // ── Terapeutas (objetos completos para filtro por área) ─────────────────────
  terapeutas: Terapeuta[] = [];
  terapeutasNombres: string[] = [];
  filtrosTerapeutas: string[] = [];
  filtroArea = '';
  areas: CatalogItem[] = [];

  // ── Disponibilidad real (horario + excepciones + citas) por terapeuta ──────
  disponibilidadPorTerapeuta = new Map<number, DisponibilidadDia[]>();

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
  fAreaId: number | null = null;
  citaEditando: Cita | null = null;

  pac1: PacienteState = this.emptyPac();
  pac2: PacienteState = this.emptyPac();
  pac2habilitado = false;

  // ── Tratamiento existente (sesiones pagadas por adelantado) ────────────────
  pacienteTratamientos: Tratamiento[] = [];
  fTratamientoExistenteId: number | null = null;

  fTer = '';
  fTipoId = '';
  fEstKey = '';
  fModalidad = 'PRESENCIAL';
  fFecha = '';       // "YYYY-MM-DD" — reemplaza fDia
  fHoraInicio = '08:00'; // "HH:MM"  — reemplaza fH, fM
  fDur = 45;
  fObs = '';

  // ── Tipo de recurrencia ─────────────────────────────────────────────────────
  fTipoRecurrencia: 'FIJO' | 'EVENTUAL' | 'SOLO_HOY' = 'EVENTUAL';

  // ── Precio / pago ────────────────────────────────────────────────────────
  fPrecio: number | null = null;
  fPagado = false;
  fMetodoPagoId: number | null = null;

  // ── Selector de fecha/hora tipo "slots" (sesión única) — fechas en pastillas +
  //    horas reales disponibles del terapeuta, en vez de inputs libres. ──────
  fFechasVisibles: { iso: string; dow: string; dia: number; mes: string }[] = [];
  fFechasOffset = 0;
  fSlotsDisponibles: string[] = [];
  fCargandoSlots = false;
  readonly DOW_ABR3 = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  readonly MES_ABR3 = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  // ── Programación múltiple ─────────────────────────────────────────────────
  modoProgramacion: 'single' | 'multiple' = 'single';
  bulkDias = [true, false, true, false, true, false, false]; // L M X J V S D
  bulkHoras = ['08:00', '08:00', '08:00', '08:00', '08:00', '08:00', '08:00']; // hora individual por día (L..D)
  bulkSesiones = 10;
  bulkFechaInicio = '';
  bulkPreview: Date[] = [];
  bulkSesionesAPagar = 10;
  /** Horario semanal general del terapeuta elegido (solo activo) — deshabilita días y acota la hora en la grilla. */
  bulkHorarioTerapeuta: TerapeutaHorario[] = [];
  bulkHorarioCargado = false;
  /** Paralelo a bulkPreview: true si esa fecha/hora choca con otra cita ya existente del terapeuta. */
  bulkConflictos: boolean[] = [];

  // ── Pago individual de cita ───────────────────────────────────────────────
  citaPagandoId: string | null = null;
  pagoMonto: number | null = null;
  pagoMetodoId: number | null = null;
  pagoTratamientoId: number | null = null;
  pagoSaldoPrevio: number = 0;
  /** true si la cita en pago está ligada a un paquete (se paga contra el tratamiento); false = cita suelta (adelantos contra cita.precio). */
  pagoEsPaquete = false;
  pagoPrecioCita = 0;
  pagoDeudaRestante = 0;
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

  // ── Grid con posicionamiento por minuto exacto ──────────────────────────────
  readonly SLOT_H = 90;   // px por fila de 1 hora, debe coincidir con --slot-h en el CSS
  horasGrid: Slot[] = []; // filas visuales de la agenda (1 por hora, 08:00 .. 19:00)

  constructor(
    private citaService: CitaService,
    private terapeutaService: TerapeutaService,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private router: Router,
    private atencionService: AtencionClinicaService,
    private disponibilidadService: DisponibilidadService,
    private terapeutaHorarioService: TerapeutaHorarioService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.generarSlots();
    this.irHoy();
    this.cargarCatalogos();
  }

  /** Requiere el permiso granular CREAR del módulo Citas Y no estar restringido a nivel de usuario (ambos configurables en Seguridad). */
  get puedeCrearCitas(): boolean {
    return this.authService.puedeCrear('CITAS') && this.authService.puedeCrearCitas();
  }
  get puedeEditarCitas(): boolean { return this.authService.puedeEditar('CITAS'); }
  get puedeEliminarCitas(): boolean { return this.authService.puedeEliminar('CITAS'); }
  /** Registrar pago desde el modal de cita usa el mismo permiso que el módulo Pagos. */
  get puedeRegistrarPago(): boolean { return this.authService.puedeCrear('PAGOS'); }

  // ── Getters ─────────────────────────────────────────────────────────────────

  /** Tipos de terapia del área seleccionada en el modal — reemplaza las pestañas fijas Regular/Kids/Consultas. */
  get tiposDeArea(): TipoTerapia[] { return this.tiposTerapia.filter(t => t.area_id === this.fAreaId); }
  /** Fecha de hoy en formato ISO (yyyy-MM-dd) — usada como mínimo en los date-pickers para no permitir fechas pasadas. */
  get hoyISO(): string { return this.fechaToISO(new Date()); }
  get tipoSeleccionado(): TipoTerapia | undefined { return this.tiposTerapia.find(t => t.id === this.fTipoId); }
  get esMultipaciente(): boolean { return (this.tipoSeleccionado?.max_pacientes ?? 1) > 1; }

  /**
   * Terapeutas que realmente pueden atender en la fecha/hora/tipo seleccionados en el modal.
   * En modo "Programar grupo" solo se filtra por área — no tiene sentido exigir que el
   * terapeuta cubra la fecha/hora por defecto de la primera sesión calculada (esa es solo una
   * suposición inicial de "días de la semana"/"hora"), porque justo eso es lo que se ajusta
   * después según SU horario real (grilla de días + hora acotada + aviso de choques). Filtrar
   * aquí también dejaría el combo vacío para cualquier terapeuta cuyo horario real no calce con
   * la suposición inicial, sin poder elegirlo nunca para corregirla.
   */
  get terapeutasDisponiblesModal(): Terapeuta[] {
    // Con un paquete seleccionado, el terapeuta ya viene fijado por el paquete (campo bloqueado
    // más abajo) — no tiene sentido filtrarlo por disponibilidad de horario: siempre debe aparecer
    // esa única opción para que el <select disabled> pueda mostrar su valor en vez de quedar vacío.
    if (this.fTratamientoExistenteId !== null) {
      return this.terapeutas.filter(t => terapeutaNombre(t) === this.fTer);
    }

    if (this.modoProgramacion === 'multiple') {
      const tipo = this.tipoSeleccionado;
      if (!tipo) return this.terapeutas;
      return this.terapeutas.filter(t => tipo.area_id == null || t.area?.id === tipo.area_id);
    }

    // Aún sin hora elegida (flujo normal: primero terapeuta, luego fecha/hora en el selector de
    // slots) — se filtra solo por área, igual que en "Programar grupo".
    if (!this.fFecha || !this.fHoraInicio) {
      const tipoPrevio = this.tipoSeleccionado;
      return !tipoPrevio ? this.terapeutas
        : this.terapeutas.filter(t => tipoPrevio.area_id == null || t.area?.id === tipoPrevio.area_id);
    }
    const inicio = this.parseFechaHora(this.fFecha, this.fHoraInicio);
    const fecha = this.fechaToISO(inicio);
    const tipo = this.tipoSeleccionado;
    if (!tipo) return this.terapeutas;

    const dur    = this.esMultipaciente ? this.fDur : tipo.duracion_minutos;
    const fin    = new Date(inicio);
    fin.setMinutes(fin.getMinutes() + dur);
    const inicioMin = inicio.getHours() * 60 + inicio.getMinutes();
    const finMin     = fin.getHours()  * 60 + fin.getMinutes();

    return this.terapeutas.filter(t => {
      const nombre = terapeutaNombre(t);

      // El terapeuta ya asignado a la cita que se está editando siempre se incluye, sin pasar
      // por los demás filtros (área/disponibilidad/capacidad): esos se calculan con datos que
      // ya incluyen esta misma cita (la caché de disponibilidad la cuenta como "ocupado", y
      // datos antiguos pueden tener un tipo de terapia que no calza con el área actual del
      // terapeuta) — igual lo excluirían incorrectamente a sí mismo. El backend revalida con
      // excluirCitaId al guardar, así que esto es seguro.
      if (this.citaEditando && nombre === this.citaEditando.terapeuta_nombre) return true;

      // El terapeuta debe pertenecer al área que requiere el tipo de terapia seleccionado
      // (ej. tipo "KIDS" → área "Kids", tipo "CONSULTA_MEDICA" → área "Consultas Médicas").
      if (tipo.area_id != null && t.area?.id !== tipo.area_id) return false;

      const solapadas = this.citasSolapadas(nombre, inicio, fin, this.citaEditando?.id);
      if (solapadas.length >= tipo.max_pacientes) return false;
      if (t.id == null) return true; // sin id: no se puede validar horario, no se bloquea

      return this.cubreFranja(t.id, fecha, inicioMin, finMin);
    });
  }

  /** Se llama al cambiar fecha/hora/duración/tipo en el modal: si el terapeuta elegido dejó de estar disponible, se limpia la selección. */
  onDatosCitaChange(): void {
    if (!this.fTer) return;
    const sigueDisponible = this.terapeutasDisponiblesModal.some(t => terapeutaNombre(t) === this.fTer);
    if (!sigueDisponible) {
      this.fTer = '';
      this.toast.warning('El terapeuta seleccionado ya no está disponible en ese horario, elige otro.');
    }
  }

  private citasSolapadas(terapeutaNombreStr: string, inicio: Date, fin: Date, excluirId?: string): Cita[] {
    return this.citas.filter(c => {
      if (c.terapeuta_nombre !== terapeutaNombreStr) return false;
      if (excluirId && c.id === excluirId) return false;
      const ini   = new Date(c.fecha_inicio);
      const finC  = new Date(c.fecha_fin);
      return inicio < finC && fin > ini;
    });
  }

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

  get areasTerapeutas(): string[] {
    const nombres = new Set(this.terapeutas.map(t => t.area?.nombre).filter(Boolean));
    return [...nombres] as string[];
  }

  get terapeutasFiltrados(): Terapeuta[] {
    if (!this.filtroArea) return this.terapeutas;
    return this.terapeutas.filter(t => (t.area?.nombre ?? '') === this.filtroArea);
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
      areas:       this.catalogService.getAreas().pipe(catchError(() => of([] as CatalogItem[]))),
    }).subscribe({
      next: ({ tipos, estados, modalidades, terapeutas, metodosPago, areas }) => {
        this.tiposTerapia      = tipos;
        this.estadosCita       = estados;
        this.modalidades       = modalidades;
        this.metodosPago       = metodosPago;
        this.areas              = areas;
        const usuario = this.authService.currentUserValue;
        // Si el usuario está restringido a solo sus propias citas, ni siquiera ve al resto
        // de terapeutas en el sidebar/filtros — no solo se le ocultan sus citas.
        this.terapeutas          = (usuario?.citasSoloPropias && usuario.terapeutaId != null)
          ? terapeutas.filter(t => t.id === usuario.terapeutaId)
          : terapeutas;
        this.terapeutasNombres = this.terapeutas.map(t => terapeutaNombre(t)).filter(Boolean);
        this.fMetodoPagoId     = metodosPago[0]?.id ?? null;
        this.cargandoCatalogos = false;
        this.resetForm();
        this.cargarDisponibilidadSemana();
      },
      error: () => { this.cargandoCatalogos = false; this.resetForm(); }
    });
  }

  /** Trae la disponibilidad real (horario + excepciones + citas) de cada terapeuta para la semana visible. */
  private cargarDisponibilidadSemana(): void {
    const idsValidos = this.terapeutas.filter(t => t.id != null);
    if (idsValidos.length === 0 || this.diasSemana.length === 0) return;

    const desde = this.fechaToISO(this.diasSemana[0].fecha);
    const hasta = this.fechaToISO(this.diasSemana[6].fecha);
    const calls = idsValidos.reduce((acc, t) => {
      acc[t.id!] = this.disponibilidadService.getSemana(t.id!, desde, hasta)
        .pipe(catchError(() => of([] as DisponibilidadDia[])));
      return acc;
    }, {} as Record<number, Observable<DisponibilidadDia[]>>);

    forkJoin(calls).subscribe(resultado => {
      this.disponibilidadPorTerapeuta.clear();
      Object.entries(resultado).forEach(([id, dias]) => this.disponibilidadPorTerapeuta.set(Number(id), dias));
    });
  }

  /** true si [inicioMin, finMin) del día `fechaISO` está cubierto por una franja libre cacheada. */
  private cubreFranja(terapeutaId: number, fechaISO: string, inicioMin: number, finMin: number): boolean {
    const dias = this.disponibilidadPorTerapeuta.get(terapeutaId);
    if (!dias) return true; // sin datos cacheados: no bloquear, el backend valida de todos modos
    const dia = dias.find(d => d.fecha === fechaISO);
    if (!dia) return true; // fuera del rango cacheado
    return dia.franjas.some(f => {
      const [fh, fm] = f.horaInicio.split(':').map(Number);
      const [th, tm] = f.horaFin.split(':').map(Number);
      return inicioMin >= fh * 60 + fm && finMin <= th * 60 + tm;
    });
  }

  // ── Slots ────────────────────────────────────────────────────────────────
  // `slots` (30 min) se usa para el cálculo de disponibilidad/capacidad (Vista Libre, sidebar).
  // `horasGrid` (1h) es solo la fila visual de la agenda semanal.

  generarSlots(): void {
    this.slots = [];
    this.horasGrid = [];
    for (let h = 8; h < 22; h++) {
      for (const m of [0, 30]) {
        const lbl = `${String(h).padStart(2,'0')}:${m === 0 ? '00' : '30'}`;
        this.slots.push({ h, m, lbl });
      }
      this.horasGrid.push({ h, m: 0, lbl: `${String(h).padStart(2,'0')}:00` });
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
    this.cargarDisponibilidadSemana();
  }

  navSemana(dir: -1 | 1): void {
    const d = new Date(this.fechaInicioSemana);
    d.setDate(d.getDate() + dir * 7);
    this.fechaInicioSemana = d;
    this.construirSemana();
    this.cargarCitas();
    this.cargarDisponibilidadSemana();
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

  filtrarPorArea(area: string): void {
    this.filtroArea = area;
    if (!area) { this.filtrosTerapeutas = []; return; }
    this.filtrosTerapeutas = this.terapeutas
      .filter(t => (t.area?.nombre ?? '') === area)
      .map(t => terapeutaNombre(t))
      .filter(Boolean);
  }

  limpiarFiltros(): void {
    this.filtrosTerapeutas = [];
    this.filtroArea = '';
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
  // Se posiciona con coordenadas de viewport (position: fixed) en vez de depender del layout
  // relativo al chip, porque `.cal-scroll` tiene overflow:auto — un popup `position: absolute`
  // que se abre a la derecha del chip queda atrapado por ese scroll y no se ve para la mayoría
  // de columnas (ya que la agenda es más ancha que el contenedor visible).
  hoverCardTop = 0;
  hoverCardLeft = 0;

  enterHover(id: string, el?: HTMLElement): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.citaHoverId = id;
    if (el) this.posicionarHoverCard(el);
  }

  /**
   * Recalcula la posición del hover card a partir del chip bajo el cursor. Se llama tanto en
   * `mouseenter` como en `mousemove` sobre el chip — así, sin importar la ruta que haya seguido
   * el mouse para llegar ahí (cruzando otros chips en el camino), la posición siempre se
   * autocorrige contra el chip que realmente está bajo el cursor en ese momento.
   *
   * Recibe el elemento directamente (referencia de plantilla), no `event.currentTarget`: esa
   * propiedad del evento deja de ser válida apenas termina el despacho síncrono, y con Zone.js
   * de por medio a veces se lee ya en null, cayendo a un elemento hijo mucho más chico (ej. el
   * texto del paciente) como respaldo — eso daba coordenadas erráticas, lejos del chip real.
   */
  posicionarHoverCard(el: HTMLElement): void {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cardW = 240;
    const margin = 6;
    let left = rect.right + margin;
    if (left + cardW > window.innerWidth - 8) {
      left = rect.left - cardW - margin;
      if (left < 8) left = Math.max(8, window.innerWidth - cardW - 8);
    }
    const cardMaxH = 340;
    let top = rect.top;
    if (top + cardMaxH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - cardMaxH - 8);
    }
    this.hoverCardTop = top;
    this.hoverCardLeft = left;
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
    this.pagoEsPaquete     = !!cita.sesion_id;

    if (this.pagoEsPaquete) {
      // Cita ligada a un paquete: se paga contra el tratamiento (precio fijo por sesión).
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
    } else {
      // Cita suelta: se puede pagar completo o en adelantos contra cita.precio.
      this.pagoMontoCargando = false;
      this.pagoPrecioCita    = cita.precio ?? 0;
      this.pagoDeudaRestante = Math.max(0, this.pagoPrecioCita - (cita.monto_pagado ?? 0));
      this.pagoMonto         = this.pagoDeudaRestante > 0 ? this.pagoDeudaRestante : null;
    }
  }

  cancelarPagoCita(): void { this.citaPagandoId = null; }

  confirmarPagoCita(cita: Cita): void {
    if (!this.pagoMonto || this.pagoMonto <= 0) {
      this.toast.warning('Ingresa un monto válido'); return;
    }
    if (this.pagoEsPaquete && !this.pagoTratamientoId) {
      this.toast.error('No se encontró paquete para este paciente'); return;
    }
    const pacienteId = Number(cita.paciente_id);
    const citaId     = Number(cita.id);
    if (!pacienteId || !citaId) return;

    if (!this.pagoEsPaquete && !this.pagoPrecioCita) {
      this.toast.error('Esta cita no tiene un precio definido — edítala para fijar un precio antes de cobrar'); return;
    }

    this.guardandoPago = true;
    const body: any = {
      paciente:      { id: pacienteId },
      cita:          { id: citaId },
      montoRecibido: this.pagoMonto,
      montoAplicado: this.pagoMonto,
      saldoGenerado: 0,
      saldoPrevio:   this.pagoSaldoPrevio,
      notas:         this.pagoEsPaquete ? 'Pago por cita individual' : 'Adelanto/pago de cita suelta',
    };
    if (this.pagoEsPaquete) body.tratamiento = { id: this.pagoTratamientoId };
    if (this.pagoMetodoId) body.metodo = { id: this.pagoMetodoId };
    this.pagoService.create(body).subscribe({
      next: () => {
        this.toast.success('Pago registrado correctamente');
        this.citaPagandoId = null;
        this.guardandoPago = false;
        this.recargarSilencioso();
        // `citaEditando` es una copia separada de `citas` — si no se resincroniza tras el pago,
        // el modal sigue mostrando el estado_pago viejo (ej. SIN_PAGO) y el botón "Registrar pago"
        // reaparece, invitando a pagar de nuevo la misma cita por error.
        if (this.citaEditando?.id === cita.id) {
          this.citaService.getCitaById(cita.id).subscribe(actualizada => {
            if (this.citaEditando?.id === cita.id) this.citaEditando = actualizada;
          });
        }
      },
      error: () => { this.toast.error('Error al registrar el pago'); this.guardandoPago = false; }
    });
  }

  // ── Slots y vistas ─────────────────────────────────────────────────────────

  /**
   * `getClustersHora`/`getFranjasLibresHora` devuelven objetos NUEVOS en cada llamada (se evalúan
   * en cada ciclo de detección de cambios de Angular). Sin `trackBy`, *ngFor compararía por
   * identidad de objeto, vería "todo distinto" en cada ciclo, y destruiría/recrearía los <div>
   * de las citas constantemente — incluso el que el mouse está tocando en ese momento, rompiendo
   * el hover y a veces el click. Estas funciones le dan a Angular una clave estable (basada en
   * los ids reales de las citas) para que reutilice el mismo DOM mientras los datos no cambien.
   */
  trackByCluster(_index: number, cl: { citas: Cita[] }): string {
    return cl.citas.map(c => c.id).join('|');
  }

  trackByFranja(_index: number, g: { minutoInicio: number }): number {
    return g.minutoInicio;
  }

  /** Citas que empiezan dentro de la hora `h` (ventana de 60 min) del día `diaIdx`, para la fila de la agenda. */
  getCitasHora(diaIdx: number, h: number): Cita[] {
    const fecha = this.diasSemana[diaIdx]?.fecha;
    if (!fecha) return [];
    const horaMin = h * 60;
    return this.citas.filter(c => {
      const ini = new Date(c.fecha_inicio);
      if (ini.getFullYear() !== fecha.getFullYear() ||
          ini.getMonth()    !== fecha.getMonth()    ||
          ini.getDate()     !== fecha.getDate()) return false;
      const citaMin = ini.getHours() * 60 + ini.getMinutes();
      if (citaMin < horaMin || citaMin >= horaMin + 60) return false;
      if (this.filtrosTerapeutas.length > 0 &&
          !this.filtrosTerapeutas.includes(c.terapeuta_nombre ?? '')) return false;
      return true;
    });
  }

  /**
   * Agrupa las citas de la hora `h` para dibujarlas: si hay más de una cita en esa hora
   * (sin importar si hay un filtro de terapeuta activo), se colapsan TODAS en un único
   * bloque "N citas" — el detalle se ve en el modal al hacer click. Con exactamente 1 cita
   * en la hora, se dibuja la tarjeta normal.
   */
  getClustersHora(diaIdx: number, h: number): { top: number; height: number; citas: Cita[] }[] {
    const pxPorMin = this.SLOT_H / 60;
    const citas = this.getCitasHora(diaIdx, h)
      .slice()
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

    if (citas.length === 0) return [];

    const iniMs = Math.min(...citas.map(c => new Date(c.fecha_inicio).getTime()));
    const finMs = Math.max(...citas.map(c => new Date(c.fecha_fin).getTime()));
    const ini = new Date(iniMs);
    const offsetMin = (ini.getHours() * 60 + ini.getMinutes()) - h * 60;

    return [{
      top:    Math.max(0, offsetMin) * pxPorMin,
      height: Math.max(20, ((finMs - iniMs) / 60000) * pxPorMin - 2),
      citas,
    }];
  }

  // ── Modal: varias citas solapadas ───────────────────────────────────────────
  modalMultiCitas = false;
  citasMultiSeleccionadas: Cita[] = [];

  abrirMultiCitas(citas: Cita[], e: Event): void {
    e.stopPropagation();
    this.citasMultiSeleccionadas = citas;
    this.modalMultiCitas = true;
  }

  cerrarMultiCitas(): void {
    this.modalMultiCitas = false;
    this.citasMultiSeleccionadas = [];
  }

  seleccionarCitaDeMulti(c: Cita, e: Event): void {
    e.stopPropagation();
    this.cerrarMultiCitas();
    this.abrirEditar(c, e);
  }

  /**
   * Huecos libres dentro de la hora `h` (los tramos NO ocupados por ninguna cita), con su posición
   * exacta en píxeles — para poder agregar una cita justo desde el minuto en que termina la anterior,
   * en vez de esperar al siguiente bloque de 30/60 min.
   */
  getFranjasLibresHora(diaIdx: number, h: number): { top: number; height: number; horaInicio: string; minutoInicio: number }[] {
    const pxPorMin     = this.SLOT_H / 60;
    const horaInicioMin = h * 60;
    const horaFinMin    = horaInicioMin + 60;

    const citas = this.getCitasHora(diaIdx, h)
      .slice()
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

    const franjas: { top: number; height: number; horaInicio: string; minutoInicio: number }[] = [];
    const build = (desdeMin: number, hastaMin: number) => {
      const hh = Math.floor(desdeMin / 60);
      const mm = desdeMin % 60;
      franjas.push({
        top:    (desdeMin - horaInicioMin) * pxPorMin,
        height: (hastaMin - desdeMin) * pxPorMin,
        horaInicio: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        minutoInicio: desdeMin,
      });
    };

    let cursor = horaInicioMin;
    for (const c of citas) {
      const ini = new Date(c.fecha_inicio);
      const fin = new Date(c.fecha_fin);
      const iniMin = Math.max(horaInicioMin, ini.getHours() * 60 + ini.getMinutes());
      const finMin = Math.min(horaFinMin, fin.getHours() * 60 + fin.getMinutes());
      if (iniMin > cursor) build(cursor, iniMin);
      cursor = Math.max(cursor, finMin);
    }
    if (cursor < horaFinMin) build(cursor, horaFinMin);

    return franjas;
  }

  /**
   * Abre el modal de nueva cita con la hora exacta del hueco libre en el que se hizo click.
   * `minutoAbsoluto` es el minuto del día completo (ej. 480 = 08:00), tal como lo entrega
   * `getFranjasLibresHora` — no un minuto dentro de la hora.
   */
  abrirSlotExacto(diaIdx: number, minutoAbsoluto: number): void {
    const h = Math.floor(minutoAbsoluto / 60);
    const m = minutoAbsoluto % 60;
    const lbl = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.abrirSlot(diaIdx, { h, m, lbl });
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

  /** Desplazamiento vertical (px) de la tarjeta dentro de su fila de 1 hora, según el minuto exacto de inicio. */
  getChipTop(c: Cita, s: Slot): number {
    const pxPorMin = this.SLOT_H / 60;
    const ini = new Date(c.fecha_inicio);
    const offsetMin = (ini.getHours() * 60 + ini.getMinutes()) - (s.h * 60 + s.m);
    return Math.max(0, offsetMin) * pxPorMin;
  }

  /**
   * Alto (px) de la tarjeta: proporcional a la duración real, pero nunca menor al mínimo
   * necesario para que se lea completa (nombre, hora, botón) sin recortarse.
   */
  getChipHeight(c: Cita): number {
    const pxPorMin = this.SLOT_H / 60;
    const proporcional = c.duracion_minutos * pxPorMin - 2;
    const minimo = (c.estado === 'EN_CURSO' || c.estado === 'CONFIRMADA' || c.estado === 'PROGRAMADA') ? 78 : 56;
    return Math.max(minimo, proporcional);
  }

  getSlotLibresDia(terapeuta: string, diaIdx: number): { slot: Slot; libre: number }[] {
    const terapeutaId = this.terapeutas.find(t => terapeutaNombre(t) === terapeuta)?.id;
    const fecha = this.diasSemana[diaIdx]?.fecha;
    const fechaISO = fecha ? this.fechaToISO(fecha) : null;

    return this.slots.map(s => {
      const citasAqui = this.getCitasSlotTer(diaIdx, s.h, s.m, terapeuta);
      const maxPac = citasAqui.length > 0
        ? this.getTipo((citasAqui[0].tipo_terapia_key ?? '').toUpperCase()).max_pacientes
        : 1;
      // Si ya hay una cita en el slot, el horario ya fue validado al crearla.
      // Si no hay ninguna, hay que confirmar que el slot cae dentro de la disponibilidad real
      // (horario semanal + excepciones) del terapeuta.
      const dentroDeHorario = citasAqui.length > 0 || terapeutaId == null || fechaISO == null
        ? true
        : this.cubreFranja(terapeutaId, fechaISO, s.h * 60 + s.m, s.h * 60 + s.m + 30);
      const libre = dentroDeHorario ? Math.max(0, maxPac - citasAqui.length) : 0;
      return { slot: s, libre };
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

  /** Se llama al cambiar el área en el modal: recarga el dropdown de tipo de terapia con los de esa área. */
  onAreaChange(): void {
    const primerTipo = this.tiposDeArea[0];
    this.fTipoId = primerTipo?.id ?? '';
    this.onTipoChange();
  }

  onTipoChange(): void {
    const tipo = this.tipoSeleccionado;
    if (tipo && this.esMultipaciente) this.fDur = tipo.duracion_minutos;
    if (tipo && !this.esMultipaciente) this.pac2habilitado = false;
    // Precio sugerido para citas sueltas (sin paquete) — solo un default, sigue siendo editable.
    if (tipo?.precio_recomendado != null && this.fTratamientoExistenteId === null) {
      this.fPrecio = tipo.precio_recomendado;
    }
    this.cargarSlotsSingle();
    this.onDatosCitaChange();
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
          if (pac === this.pac1) this.cargarTratamientosPaciente(pac.id!);
        } else {
          pac.id = null; pac.nombre = ''; pac.apellido = '';
          pac.telefono = ''; pac.correo = ''; pac.modo = 'nuevo';
          if (pac === this.pac1) this.limpiarTratamientoExistente();
        }
      },
      error: () => { pac.buscando = false; pac.modo = 'nuevo'; pac.id = null; }
    });
  }

  cambiarPaciente(pac: PacienteState): void {
    pac.modo = 'buscar'; pac.id = null;
    pac.nombre = ''; pac.apellido = ''; pac.telefono = ''; pac.correo = '';
    pac.colapsado = false;
    if (pac === this.pac1) this.limpiarTratamientoExistente();
  }

  // ── Tratamiento existente (sesiones pagadas por adelantado) ────────────────

  coberturaPorTratamiento = new Map<number, TratamientoCobertura>();

  private cargarTratamientosPaciente(pacienteId: number): void {
    this.tratamientoService.getByPaciente(pacienteId).subscribe({
      next: lista => {
        this.pacienteTratamientos = lista.filter(t => t.estadoKey === 'ACTIVO');
        this.fTratamientoExistenteId = null;
        this.cargarCoberturas();
      },
      error: () => { this.pacienteTratamientos = []; this.fTratamientoExistenteId = null; }
    });
  }

  /** Trae, para cada tratamiento activo del paciente, cuántas sesiones ya tienen cita creada y cuántas pagadas. */
  private cargarCoberturas(): void {
    this.coberturaPorTratamiento.clear();
    const ids = this.pacienteTratamientos.map(t => t.id).filter((id): id is number => id != null);
    if (ids.length === 0) return;
    const calls = ids.reduce((acc, id) => {
      acc[id] = this.tratamientoService.getCobertura(id).pipe(catchError(() => of(null)));
      return acc;
    }, {} as Record<number, Observable<TratamientoCobertura | null>>);
    forkJoin(calls).subscribe(resultado => {
      Object.entries(resultado).forEach(([id, cob]) => { if (cob) this.coberturaPorTratamiento.set(Number(id), cob); });
    });
  }

  coberturaDe(t: Tratamiento): TratamientoCobertura | null {
    return t.id != null ? this.coberturaPorTratamiento.get(t.id) ?? null : null;
  }

  private limpiarTratamientoExistente(): void {
    this.pacienteTratamientos = [];
    this.fTratamientoExistenteId = null;
    this.coberturaPorTratamiento.clear();
  }

  get tratamientoExistenteSeleccionado(): Tratamiento | null {
    return this.pacienteTratamientos.find(t => t.id === this.fTratamientoExistenteId) ?? null;
  }

  get coberturaSeleccionada(): TratamientoCobertura | null {
    const t = this.tratamientoExistenteSeleccionado;
    return t ? this.coberturaDe(t) : null;
  }

  /** Cuántas sesiones del paquete ya están cubiertas por lo cobrado hasta ahora (totalCobrado / precioPorSesion). */
  get sesionesCubiertasTratamiento(): number {
    const t = this.tratamientoExistenteSeleccionado;
    if (!t || !t.precioPorSesion) return 0;
    return Math.floor((t.totalCobrado ?? 0) / t.precioPorSesion);
  }

  /** Cupos que quedan libres en el paquete seleccionado (sesiones totales - sesiones que ya tienen cita creada). Null = sin paquete, sin límite. */
  get cuposDisponiblesTratamiento(): number | null {
    const t = this.tratamientoExistenteSeleccionado;
    if (!t) return null;
    const cob = this.coberturaDe(t);
    const creadas = cob?.sesionesCreadas ?? 0;
    const total = t.totalSesiones ?? 0;
    return Math.max(0, total - creadas);
  }

  onTratamientoExistenteChange(): void {
    const t = this.tratamientoExistenteSeleccionado;
    if (!t) { this.calcularBulkDates(); return; }

    // El tratamiento ya define área/tipo/terapeuta/precio — se sincronizan y se bloquean
    // en el formulario (más abajo, con [disabled]) para que no queden desalineados.
    if (t.tipoTerapiaKey) {
      const tipoObj = this.tiposTerapia.find(x => x.id === t.tipoTerapiaKey);
      if (tipoObj?.area_id != null) this.fAreaId = tipoObj.area_id;
      this.fTipoId = t.tipoTerapiaKey;
    }
    if (t.terapeutaNombre) this.fTer = t.terapeutaNombre;
    this.fPrecio = t.precioPorSesion ?? null;

    // El paquete no puede generar más citas que cupos le quedan libres.
    const cupos = this.cuposDisponiblesTratamiento;
    if (cupos !== null && this.bulkSesiones > cupos) this.bulkSesiones = cupos;
    this.calcularBulkDates();
  }

  togglePac(pac: PacienteState): void {
    if (pac.modo !== 'buscar') pac.colapsado = !pac.colapsado;
  }

  // ── Modal ────────────────────────────────────────────────────────────────────

  abrirNueva(): void {
    if (!this.puedeCrearCitas) return;
    this.citaEditando = null; this.resetForm(); this.modalAbierto = true;
  }

  abrirSlot(diaIdx: number, s: Slot): void {
    if (!this.puedeCrearCitas) return;
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
    this.fTipoRecurrencia = cita.tipo_recurrencia ?? 'EVENTUAL';
    this.fAreaId    = this.tiposTerapia.find(t => t.id === this.fTipoId)?.area_id ?? null;
    this.modoProgramacion = 'single';
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; this.citaEditando = null; }

  irAPaquete(): void {
    const id = this.citaEditando?.tratamiento_id;
    if (id) { this.cerrarModal(); this.router.navigate(['/tratamientos', id]); }
  }

  resetForm(): void {
    this.pac1 = this.emptyPac();
    this.pac2 = this.emptyPac();
    this.pac2habilitado = false;
    this.limpiarTratamientoExistente();
    this.fTer    = this.terapeutasNombres[0] ?? '';
    this.fAreaId = this.areas[0]?.id ?? null;
    const primerTipo = this.tiposDeArea[0] ?? this.tiposTerapia[0];
    this.fTipoId = primerTipo?.id ?? '';
    const hoy = new Date();
    this.fFecha     = this.fechaToISO(hoy);
    this.fHoraInicio = '';
    this.fDur       = primerTipo?.duracion_minutos ?? 45;
    this.fEstKey    = this.estadosCita[0]?.key  ?? 'PROGRAMADA';
    this.fModalidad = this.modalidades[0]?.key  ?? 'PRESENCIAL';
    this.fObs       = '';
    this.fTipoRecurrencia = 'EVENTUAL';
    this.fPrecio    = primerTipo?.precio_recomendado ?? null;
    this.fPagado    = false;
    this.fMetodoPagoId = this.metodosPago[0]?.id ?? null;
    this.modoProgramacion = 'single';
    this.fFechasOffset = 0;
    this.generarFechasVisiblesSingle();
    this.cargarSlotsSingle();
    this.bulkDias   = [true, false, true, false, true, false, false];
    this.bulkHoras  = ['08:00', '08:00', '08:00', '08:00', '08:00', '08:00', '08:00'];
    this.bulkSesiones        = 10;
    this.bulkFechaInicio     = this.fechaToISO(hoy);
    this.bulkPreview         = [];
    this.bulkSesionesAPagar  = this.bulkSesiones;
    this.bulkHorarioTerapeuta = [];
    this.bulkHorarioCargado  = false;
    this.bulkConflictos      = [];
    this.calcularBulkDates();
  }

  // ── Programación múltiple ──────────────────────────────────────────────────

  /** Al activar un día, si no tenía hora propia asignada la hereda de "Hora inicio" como default editable. */
  onBulkDiaToggle(i: number): void {
    if (this.bulkDias[i] && !this.bulkHoras[i]) this.bulkHoras[i] = this.fHoraInicio || '08:00';
    this.calcularBulkDates();
    this.onDatosCitaChange();
  }

  /** Al elegir terapeuta, trae su horario semanal general para deshabilitar días/horas que no atiende. */
  onFTerChange(): void {
    if (this.modoProgramacion === 'multiple') this.cargarHorarioTerapeutaBulk();
    else this.cargarSlotsSingle();
  }

  private cargarHorarioTerapeutaBulk(): void {
    const terapeuta = this.terapeutas.find(t => terapeutaNombre(t) === this.fTer);
    if (!terapeuta?.id) {
      this.bulkHorarioTerapeuta = []; this.bulkHorarioCargado = false;
      return;
    }
    this.terapeutaHorarioService.getByTerapeuta(terapeuta.id).subscribe({
      next: horarios => {
        this.bulkHorarioTerapeuta = horarios.filter(h => h.activo);
        this.bulkHorarioCargado = true;
        this.ajustarBulkDiasSegunHorario();
        this.calcularBulkDates();
      },
      error: () => { this.bulkHorarioTerapeuta = []; this.bulkHorarioCargado = false; }
    });
  }

  /** true si el terapeuta atiende ese día de la semana (i: 0=Lunes..6=Domingo) según su horario general.
   *  Mientras no se haya cargado el horario (o no hay terapeuta elegido aún) no bloquea nada. */
  diaHabilitadoBulk(i: number): boolean {
    if (!this.bulkHorarioCargado) return true;
    return this.bulkHorarioTerapeuta.some(h => h.diaSemana === i + 1);
  }

  /** Franjas reales (sin fusionar) del horario del terapeuta para ese día de la semana. */
  private franjasBulkDia(i: number): { horaInicio: string; horaFin: string }[] {
    return this.bulkHorarioTerapeuta
      .filter(h => h.diaSemana === i + 1)
      .map(h => ({ horaInicio: h.horaInicio, horaFin: h.horaFin }));
  }

  /** Horas puntuales (cada 30 min) donde cabe una sesión completa dentro del horario real de ese día. */
  slotsDisponiblesBulkDia(i: number): string[] {
    const franjas = this.franjasBulkDia(i);
    if (franjas.length === 0) return [];
    const tipo = this.tipoSeleccionado;
    const dur = this.esMultipaciente ? this.fDur : (tipo?.duracion_minutos ?? 45);
    return this.calcularSlotsDesdeFranjas(franjas, dur);
  }

  seleccionarSlotBulkDia(i: number, hora: string): void {
    this.bulkHoras[i] = hora;
    this.calcularBulkDates();
    this.onDatosCitaChange();
  }

  /** Divide una lista de franjas [horaInicio,horaFin) en horas puntuales cada `paso` minutos,
   *  descartando las que no dejan espacio completo para la duración de la sesión. */
  private calcularSlotsDesdeFranjas(franjas: { horaInicio: string; horaFin: string }[], duracionMin: number, paso = 30): string[] {
    const out: string[] = [];
    for (const f of franjas) {
      const [fh, fm] = f.horaInicio.split(':').map(Number);
      const [th, tm] = f.horaFin.split(':').map(Number);
      const fin = th * 60 + tm;
      for (let cursor = fh * 60 + fm; cursor + duracionMin <= fin; cursor += paso) {
        out.push(`${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`);
      }
    }
    return out;
  }

  /** Desmarca los días que el usuario había activado pero el terapeuta elegido no atiende, y
   *  si la hora actual de un día activo ya no cabe en su horario real, la reemplaza por el
   *  primer slot disponible de ese día (ej. el 08:00 default no tiene sentido si el terapeuta
   *  recién empieza a las 13:00). */
  private ajustarBulkDiasSegunHorario(): void {
    for (let i = 0; i < 7; i++) {
      if (this.bulkDias[i] && !this.diaHabilitadoBulk(i)) { this.bulkDias[i] = false; continue; }
      if (!this.bulkDias[i]) continue;
      const slots = this.slotsDisponiblesBulkDia(i);
      if (slots.length > 0 && !slots.includes(this.bulkHoras[i])) this.bulkHoras[i] = slots[0];
    }
  }

  /** Trae la disponibilidad real (horario + excepciones + citas ya agendadas) del terapeuta para todo
   *  el rango de fechas que abarca bulkPreview, y marca en bulkConflictos qué sesiones calculadas
   *  chocarían con una cita que el terapeuta ya tiene — así se ve antes de guardar, no después. */
  private cargarConflictosBulk(): void {
    const terapeuta = this.terapeutas.find(t => terapeutaNombre(t) === this.fTer);
    if (!terapeuta?.id || this.bulkPreview.length === 0) { this.bulkConflictos = []; return; }
    const terapeutaId = terapeuta.id;
    const desde = this.fechaToISO(this.bulkPreview[0]);
    const hasta = this.fechaToISO(this.bulkPreview[this.bulkPreview.length - 1]);
    this.disponibilidadService.getSemana(terapeutaId, desde, hasta).subscribe({
      next: dias => {
        this.disponibilidadPorTerapeuta.set(terapeutaId, dias);
        const tipo = this.tipoSeleccionado;
        const dur = this.esMultipaciente ? this.fDur : (tipo?.duracion_minutos ?? 45);
        this.bulkConflictos = this.bulkPreview.map(d => {
          const fecha = this.fechaToISO(d);
          const inicioMin = d.getHours() * 60 + d.getMinutes();
          return !this.cubreFranja(terapeutaId, fecha, inicioMin, inicioMin + dur);
        });
      },
      error: () => { this.bulkConflictos = []; }
    });
  }

  get bulkTieneConflictos(): boolean { return this.bulkConflictos.some(c => c); }
  get bulkTotalConflictos(): number { return this.bulkConflictos.filter(c => c).length; }

  // ── Selector de fecha/hora tipo "slots" (sesión única) ───────────────────────

  private generarFechasVisiblesSingle(): void {
    const base = new Date();
    base.setDate(base.getDate() + this.fFechasOffset);
    const dias: { iso: string; dow: string; dia: number; mes: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dias.push({
        iso: this.fechaToISO(d),
        dow: this.DOW_ABR3[d.getDay()],
        dia: d.getDate(),
        mes: this.MES_ABR3[d.getMonth()],
      });
    }
    this.fFechasVisibles = dias;
  }

  fFechasAnterior(): void {
    if (this.fFechasOffset <= 0) return;
    this.fFechasOffset = Math.max(0, this.fFechasOffset - 6);
    this.generarFechasVisiblesSingle();
  }

  fFechasSiguiente(): void {
    this.fFechasOffset += 6;
    this.generarFechasVisiblesSingle();
  }

  seleccionarFechaSingle(iso: string): void {
    this.fFecha = iso;
    this.fHoraInicio = '';
    this.cargarSlotsSingle();
    this.onDatosCitaChange();
  }

  seleccionarSlotSingle(hora: string): void {
    this.fHoraInicio = hora;
    this.onDatosCitaChange();
  }

  /** Trae las franjas libres reales del terapeuta ese día puntual (horario + excepciones + citas
   *  ya agendadas) y las parte en horas puntuales donde cabe la duración del tipo elegido. */
  cargarSlotsSingle(): void {
    const terapeuta = this.terapeutas.find(t => terapeutaNombre(t) === this.fTer);
    const tipo = this.tipoSeleccionado;
    if (!terapeuta?.id || !this.fFecha || !tipo) { this.fSlotsDisponibles = []; return; }
    const dur = this.esMultipaciente ? this.fDur : tipo.duracion_minutos;
    this.fCargandoSlots = true;
    this.disponibilidadService.getDia(terapeuta.id, this.fFecha).subscribe({
      next: dia => {
        this.fSlotsDisponibles = this.calcularSlotsDesdeFranjas(dia.franjas, dur);
        this.fCargandoSlots = false;
      },
      error: () => { this.fSlotsDisponibles = []; this.fCargandoSlots = false; }
    });
  }

  calcularBulkDates(): void {
    this.bulkPreview = [];

    // El paquete seleccionado (si hay) limita cuántas citas nuevas se pueden crear.
    const cupos = this.cuposDisponiblesTratamiento;
    if (cupos !== null && this.bulkSesiones > cupos) this.bulkSesiones = cupos;

    if (!this.bulkFechaInicio) return;
    const diasActivos = this.bulkDias.map((v, i) => v ? i : -1).filter(i => i >= 0);
    if (diasActivos.length === 0 || this.bulkSesiones < 1) return;

    const [y, mo, d] = this.bulkFechaInicio.split('-').map(Number);

    let cursor = new Date(y, mo - 1, d);
    let count = 0;
    let tries = 0;

    while (count < this.bulkSesiones && tries < 366) {
      tries++;
      const dow = (cursor.getDay() + 6) % 7; // 0=Lunes … 6=Domingo
      if (diasActivos.includes(dow)) {
        const [fH, fM] = (this.bulkHoras[dow] || this.fHoraInicio || '08:00').split(':').map(Number);
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
    this.cargarConflictosBulk();
  }

  // ── Guardar cita ──────────────────────────────────────────────────────────

  guardarCita(): void {
    if (!this.pac1.nombre.trim() || !this.pac1.apellido.trim()) {
      this.toast.warning('Completa los datos del paciente 1'); return;
    }
    // El correo es obligatorio solo para pacientes NUEVOS (se usa para crearles su cuenta de acceso) —
    // uno ya encontrado por DNI no necesita tocarse aquí.
    if (this.pac1.modo === 'nuevo' && !this.pac1.correo.trim()) {
      this.toast.warning('El correo del paciente 1 es obligatorio (se usa para crear su cuenta de acceso)'); return;
    }
    if (this.esMultipaciente && this.pac2habilitado && this.pac2.modo === 'nuevo' && this.pac2.nombre.trim() && !this.pac2.correo.trim()) {
      this.toast.warning('El correo del paciente 2 es obligatorio (se usa para crear su cuenta de acceso)'); return;
    }
    if (!this.fTer)    { this.toast.warning('Selecciona un terapeuta');        return; }
    if (!this.fTipoId) { this.toast.warning('Selecciona un tipo de terapia'); return; }
    if (!this.fFecha || !this.fHoraInicio) { this.toast.warning('Selecciona fecha y hora'); return; }

    if (!this.citaEditando) {
      const chequear = this.modoProgramacion === 'multiple' ? this.bulkPreview : [this.parseFechaHora(this.fFecha, this.fHoraInicio)];
      if (chequear.some(f => f < new Date())) {
        this.toast.warning('No se pueden crear citas en una fecha u hora que ya pasó'); return;
      }
    }

    if (this.modoProgramacion === 'multiple' && !this.citaEditando) {
      this.guardarBulk(); return;
    }

    const tipo = this.tipoSeleccionado!;
    const dur  = this.esMultipaciente ? this.fDur : tipo.duracion_minutos;
    const fechaSlot = this.parseFechaHora(this.fFecha, this.fHoraInicio);
    const fechaFin  = new Date(fechaSlot);
    fechaFin.setMinutes(fechaFin.getMinutes() + dur);

    // Validación best-effort de horario (el backend es la autoridad final). La grilla de
    // disponibilidad cacheada (this.disponibilidadPorTerapeuta) resta TODAS las citas ya
    // agendadas del terapeuta — incluida esta misma, si estamos editándola. Sin este chequeo,
    // guardar una cita sin tocar ni terapeuta ni fecha/hora la marcaría como "fuera de horario"
    // porque ese slot aparece ocupado... por ella misma.
    const terapeutaSel = this.terapeutas.find(t => terapeutaNombre(t) === this.fTer);
    const sinCambioDeHorario = !!this.citaEditando
      && terapeutaSel?.id != null
      && String(terapeutaSel.id) === this.citaEditando.terapeuta_id
      && fechaSlot.getTime() === new Date(this.citaEditando.fecha_inicio).getTime();
    if (terapeutaSel?.id != null && !sinCambioDeHorario) {
      const inicioMin = fechaSlot.getHours() * 60 + fechaSlot.getMinutes();
      const finMin    = fechaFin.getHours()  * 60 + fechaFin.getMinutes();
      if (!this.cubreFranja(terapeutaSel.id, this.fFecha, inicioMin, finMin)) {
        this.toast.error('El terapeuta no atiende en ese horario (fuera de su horario habitual o bloqueado por una excepción).');
        return;
      }
    }

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
        tipo_recurrencia:  this.fTipoRecurrencia,
      };
      this.citaService.actualizarCitaLocal(this.citaEditando.id, req).subscribe({
        next: () => {
          this.toast.success('Cita actualizada correctamente');
          this.cerrarModal(); this.recargarSilencioso(); this.guardando = false;
        },
        error: (err) => { this.toast.error(err?.error?.error || 'Error al actualizar la cita'); this.guardando = false; }
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
        tratamientoId:     this.fTratamientoExistenteId,
        tipoRecurrencia:   this.fTipoRecurrencia,
      };

      this.citaService.crearConPaciente(req).subscribe({
        next: (citas) => {
          if (this.fTratamientoExistenteId === null && this.fPrecio && this.fPrecio > 0 && this.fPagado && citas.length > 0) {
            const pacienteId = Number(citas[0].paciente_id);
            const citaId     = Number(citas[0].id);
            if (pacienteId) this.crearPagoParaCita(pacienteId, this.fPrecio, this.fMetodoPagoId, citaId);
          }
          this.toast.success('Cita creada correctamente');
          this.cerrarModal(); this.recargarSilencioso(); this.guardando = false;
        },
        error: (err) => { this.toast.error(err?.error?.error || 'Error al crear la cita'); this.guardando = false; }
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
    let primerError: string | null = null;
    const total = this.bulkPreview.length;

    const crearSiguiente = (index: number): void => {
      if (index >= total) {
        if (creadas === total) {
          this.toast.success(`${creadas} de ${total} citas creadas correctamente`);
        } else {
          this.toast.error(`${creadas} de ${total} citas creadas` + (primerError ? ` — ${primerError}` : ''));
        }
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
        tipoRecurrencia: this.fTipoRecurrencia,
        modalidadKey:    this.fModalidad,
        observacion:     this.fObs || undefined,
        totalSesionesPlan: total,
        precioPorSesion:   this.fPrecio ?? 0,
        tratamientoId:     this.fTratamientoExistenteId,
      };
      this.citaService.crearConPaciente(req).subscribe({
        next: (citas) => {
          creadas++;
          if (this.fTratamientoExistenteId === null && this.fPrecio && this.fPrecio > 0 && index < this.bulkSesionesAPagar && citas.length > 0) {
            const pid    = Number(citas[0].paciente_id);
            const citaId = Number(citas[0].id);
            if (pid) this.crearPagoParaCita(pid, this.fPrecio, this.fMetodoPagoId, citaId);
          }
          crearSiguiente(index + 1);
        },
        error: (err) => {
          if (!primerError) primerError = err?.error?.error || 'error al crear una de las citas';
          crearSiguiente(index + 1);
        }
      });
    };

    crearSiguiente(0);
  }

  /**
   * Registra el pago de una cita recién creada. Si se eligió "usar paquete existente"
   * (fTratamientoExistenteId), el pago se aplica contra ese paquete; si no, es un pago
   * normal de la cita puntual, sin ningún tratamiento asociado.
   */
  private crearPagoParaCita(pacienteId: number, monto: number, metodoId: number | null, citaId?: number): void {
    const t = this.tratamientoExistenteSeleccionado;
    const body: any = {
      tratamiento:   t ? { id: t.id } : undefined,
      paciente:      { id: pacienteId },
      montoRecibido: monto,
      montoAplicado: monto,
      saldoGenerado: 0,
      saldoPrevio:   t?.saldoAFavor ?? 0,
      notas:         'Pagado al crear cita',
    };
    if (metodoId) body.metodo = { id: metodoId };
    if (citaId)   body.cita   = { id: citaId };
    this.pagoService.create(body).subscribe({ error: () => {} });
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
    if (cita.estado_pago_key !== 'PAGADA') {
      this.toast.warning('La cita debe estar pagada por completo para registrar atención'); return;
    }
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
