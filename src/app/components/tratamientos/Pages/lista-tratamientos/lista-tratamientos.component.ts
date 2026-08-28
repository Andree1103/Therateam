import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, from, of } from 'rxjs';
import { concatMap, toArray, map, catchError } from 'rxjs/operators';
import { TratamientoService, TratamientoFiltros } from '../../Services/tratamiento.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { Paciente } from '../../../pacientes/Models/paciente.model';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Tratamiento, TratamientoForm, Sesion, CitaResumen, tratamientoPaciente, tratamientoTerapeuta } from '../../Models/tratamiento.model';
import { CitaService } from '../../../citas/Services/cita.service';
import { CrearCitaConPacienteRequest, CrearCitaLocalRequest, PacienteEnCita } from '../../../citas/Models/cita.model';
import { DisponibilidadService } from '../../../terapeutas/Services/disponibilidad.service';
import { TerapeutaHorarioService } from '../../../terapeutas/Services/terapeuta-horario.service';
import { TerapeutaHorario } from '../../../terapeutas/Models/terapeuta-horario.model';
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
  busquedaNombre: string;
  resultadosBusqueda: Paciente[];
  dropdownAbierto: boolean;
}
import { Terapeuta, terapeutaNombre as nombreDeTerapeuta } from '../../../terapeutas/Models/terapeuta.model';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';
import { ExcelExportService } from '../../../../core/services/excel-export.service';

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
  estadosCita: CatalogItem[] = [];
  modalidadesCita: CatalogItem[] = [];
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
  areaBusqueda = '';
  areaDropdownAbierto = false;
  areaBusquedaTocado = false;
  tipoBusqueda = '';
  tipoDropdownAbierto = false;
  nombreDeTerapeuta = nombreDeTerapeuta;

  // ── Pago inicial (solo al crear): pendiente / pagado completo / adelanto ──
  pagoModo: 'pendiente' | 'completo' | 'parcial' = 'pendiente';
  pagoMonto: number | null = null;
  pagoMetodoId: number | null = null;
  /** N° de operación del pago inicial — el comprobante de Yape/Plin/transferencia. */
  pagoReferencia = '';
  metodosPago: CatalogItem[] = [];

  // ── Programar horario recurrente (solo al crear, igual que "Programar sesiones
  //    recurrentes" en Citas) — al guardar el paquete, crea de una vez todas sus citas. ─────
  readonly DIAS_NOM = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  readonly DIAS_ABR = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  duracionSesionMin: number | null = null;
  bulkDias: boolean[] = [true, false, true, false, true, false, false];
  bulkHoras: string[] = ['08:00', '08:00', '08:00', '08:00', '08:00', '08:00', '08:00'];
  bulkPreview: Date[] = [];
  bulkHorarioTerapeuta: TerapeutaHorario[] = [];
  bulkHorarioCargado = false;
  bulkConflictos: boolean[] = [];
  guardandoCitas = false;
  // Solo al editar: crear las sesiones que aún faltan, o reprogramar las citas futuras ya creadas.
  bulkAccionEdicion: 'crear' | 'reprogramar' = 'crear';
  bulkFechaDesdeEdicion = '';
  aplicandoHorarioEdicion = false;

  get montoTotalPaquete(): number {
    return (this.formData.sesionesTotal ?? 0) * (this.formData.precioPorSesion ?? 0);
  }

  get total() { return this.totalElementos; }
  pacienteNombre = tratamientoPaciente;
  terapeutaNombre = tratamientoTerapeuta;

  exportando = false;

  constructor(
    private tratamientoService: TratamientoService,
    private pacienteService: PacienteService,
    private terapeutaService: TerapeutaService,
    private pagoService: PagoService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private authService: AuthService,
    private citaService: CitaService,
    private disponibilidadService: DisponibilidadService,
    private terapeutaHorarioService: TerapeutaHorarioService,
    private route: ActivatedRoute,
    private router: Router,
    private excelExportService: ExcelExportService
  ) {}

  /** Exporta TODOS los paquetes/cronogramas que cumplen los filtros activos (no solo la página visible). */
  exportarExcel(): void {
    this.exportando = true;
    const filtros: TratamientoFiltros = {
      paciente: this.filtroPaciente,
      terapeuta: this.filtroTerapeuta,
      tipoTerapiaId: this.filtroTipoTerapiaId,
      estado: this.filtroEstado,
    };
    this.tratamientoService.getAllPaged(0, 10000, filtros).subscribe({
      next: res => {
        this.exportando = false;
        if (res.content.length === 0) { this.toast.warning('No hay paquetes para exportar con los filtros actuales'); return; }
        const filas = res.content.map(t => ({
          'Paquete': t.nombre ?? '',
          'Paciente': tratamientoPaciente(t),
          'DNI': t.pacienteDni ?? '',
          'Terapeuta': tratamientoTerapeuta(t),
          'Tipo de terapia': t.tipoTerapiaNombre ?? '',
          'Estado': t.estadoNombre ?? '',
          'Fecha inicio': t.fechaInicio ?? '',
          'Fecha creación': t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-PE') : '',
          'Sesiones totales': t.totalSesiones ?? '',
          'Sesiones atendidas': t.sesionesAtendidas ?? '',
          'Sesiones pendientes': t.sesionesPendientes ?? '',
          'Precio por sesión (S/)': t.precioPorSesion ?? '',
          'Monto total (S/)': t.montoTotal ?? '',
          'Total cobrado (S/)': t.totalCobrado ?? '',
          'Saldo a favor (S/)': t.saldoAFavor ?? '',
          'Activo': t.activo ? 'Sí' : 'No',
          'Usuario creación': t.usuarioCreacionNombre ?? '',
        }));
        this.excelExportService.exportar(filas, 'paquetes');
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar paquetes'); }
    });
  }

  get puedeCrear(): boolean { return this.authService.puedeCrear('PAQUETES'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('PAQUETES'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('PAQUETES'); }

  ngOnInit(): void {
    this.cargar();
    this.catalogService.getEspecialidades().subscribe(d => this.especialidades = d);
    this.catalogService.getAreas().subscribe(d => this.areas = d);
    this.catalogService.getMetodosPago().subscribe(d => this.metodosPago = d);
    this.catalogService.getPlantillasPaquete().subscribe(d => this.plantillas = d.filter(p => p.activo !== false));
    this.catalogService.getEstadosCita().subscribe(d => this.estadosCita = d);
    this.catalogService.getModalidades().subscribe(d => this.modalidadesCita = d);

    // abrirEditar() necesita terapeutas/tipos/estados ya cargados para resolver correctamente
    // el paquete — se esperan los tres antes de abrir el modal (tanto para el query param
    // ?editar=<id> como en general).
    forkJoin({
      terapeutas: this.terapeutaService.getAll(),
      tipos: this.catalogService.getTiposTerapia(),
      estados: this.catalogService.getEstadosTratamiento(),
    }).subscribe(({ terapeutas, tipos, estados }) => {
      this.terapeutasTodos = terapeutas;
      this.tiposTerapia = tipos;
      this.estadosTratamiento = estados;

      // Si se llegó desde "completar sesiones faltantes" en el detalle del paquete
      // (/tratamientos?editar=<id>), se abre directo el modal de edición de ese paquete.
      const editarId = Number(this.route.snapshot.queryParamMap.get('editar'));
      if (editarId) {
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
        this.tratamientoService.getById(editarId).subscribe({
          next: t => this.abrirEditar(t),
          error: () => this.toast.error('No se encontró el paquete a editar')
        });
      }
    });
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
    if (this.fAreaId != null) this.areaBusqueda = this.areas.find(a => a.id === this.fAreaId)?.nombre ?? p.area?.nombre ?? '';
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

  // ── Paciente por nombre: busca uno existente o deja capturar uno nuevo ──────

  private emptyPac(): PacienteState {
    return {
      colapsado: false, modo: 'buscar', buscando: false, id: null,
      dni: '', nombre: '', apellido: '', telefono: '', correo: '',
      busquedaNombre: '', resultadosBusqueda: [], dropdownAbierto: false,
    };
  }

  private debounceBusquedaPac: ReturnType<typeof setTimeout> | undefined;

  onBusquedaNombreChange(): void {
    this.pac.dropdownAbierto = true;
    clearTimeout(this.debounceBusquedaPac);
    const q = this.pac.busquedaNombre.trim();
    if (q.length < 2) { this.pac.resultadosBusqueda = []; this.pac.buscando = false; return; }
    this.pac.buscando = true;
    this.debounceBusquedaPac = setTimeout(() => {
      this.pacienteService.getAllPaged(0, 8, { nombre: q }).subscribe({
        next: res => { this.pac.resultadosBusqueda = res.content; this.pac.buscando = false; },
        error: () => { this.pac.resultadosBusqueda = []; this.pac.buscando = false; }
      });
    }, 300);
  }

  abrirDropdownPaciente(e: Event): void {
    this.pac.dropdownAbierto = true;
    const el = e.target as HTMLElement;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }
  cerrarDropdownPacienteDiferido(): void { setTimeout(() => this.pac.dropdownAbierto = false, 150); }

  seleccionarPacienteBusqueda(encontrado: Paciente): void {
    this.pac.id = encontrado.id ?? null;
    this.pac.nombre = encontrado.nombre;
    this.pac.apellido = encontrado.apellido;
    this.pac.dni = encontrado.dni ?? '';
    this.pac.telefono = encontrado.telefono ?? '';
    this.pac.correo = encontrado.correo ?? '';
    this.pac.modo = 'encontrado';
    this.pac.dropdownAbierto = false;
    this.pac.busquedaNombre = `${encontrado.nombre} ${encontrado.apellido}`;
    this.formData.pacienteId = this.pac.id;
  }

  /** El paciente buscado no existe todavía — pasa a modo "nuevo" precargando nombre/apellido
   *  con lo ya escrito en el buscador. */
  crearPacienteNuevo(): void {
    this.pac.id = null; this.pac.dni = ''; this.pac.telefono = ''; this.pac.correo = '';
    const partes = this.pac.busquedaNombre.trim().split(/\s+/).filter(Boolean);
    this.pac.nombre = partes[0] ?? '';
    this.pac.apellido = partes.slice(1).join(' ');
    this.pac.modo = 'nuevo';
    this.pac.dropdownAbierto = false;
    this.formData.pacienteId = null;
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
    this.onTerapeutaCambiadoParaHorario();
  }

  // ── Buscador de área (autocompletar, igual patrón que Tipo de terapia) ────

  get areasFiltradas(): CatalogItem[] {
    const q = this.areaBusqueda.toLowerCase().trim();
    return !q ? this.areas : this.areas.filter(a => a.nombre.toLowerCase().includes(q));
  }

  abrirAreaDropdown(): void { this.areaDropdownAbierto = true; }
  cerrarAreaDropdownDiferido(): void { setTimeout(() => this.areaDropdownAbierto = false, 150); }

  seleccionarArea(a: CatalogItem): void {
    this.fAreaId = a.id;
    this.areaBusqueda = a.nombre;
    this.areaDropdownAbierto = false;
    this.onAreaChange();
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
    if (t.area?.id != null) { this.fAreaId = t.area.id; this.areaBusqueda = t.area.nombre ?? this.areaBusqueda; }
    // El terapeuta ya elegido puede no pertenecer a la nueva área — se limpia para forzar re-selección.
    const terapeutaActual = this.terapeutasTodos.find(x => x.id === this.formData.terapeutaId);
    if (terapeutaActual && terapeutaActual.area?.id !== t.area?.id) {
      this.formData.terapeutaId = null;
    }
    // La duración del tipo es solo un default sugerido para las sesiones del horario — sigue editable.
    this.duracionSesionMin = t.duracionMinutos ?? this.duracionSesionMin;
    this.calcularBulkDates();
  }

  // ── Programar horario recurrente (solo al crear) ─────────────────────────────

  private fechaToISO(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private get duracionSesion(): number {
    return Number(this.duracionSesionMin) || this.tipoSeleccionado?.duracionMinutos || 45;
  }

  /** Al elegir terapeuta, trae su horario semanal real para deshabilitar días/horas que no atiende.
   *  Se pide fresco cada vez — no se guarda de una apertura de modal a otra. */
  onTerapeutaCambiadoParaHorario(): void {
    this.bulkHorarioTerapeuta = [];
    this.bulkHorarioCargado = false;
    this.bulkConflictos = [];
    if (!this.formData.terapeutaId) { this.calcularBulkDates(); return; }
    this.terapeutaHorarioService.getByTerapeuta(this.formData.terapeutaId).subscribe({
      next: horarios => {
        this.bulkHorarioTerapeuta = horarios.filter(h => h.activo);
        this.bulkHorarioCargado = true;
        this.ajustarBulkDiasSegunHorario();
        this.calcularBulkDates();
      },
      error: () => { this.bulkHorarioTerapeuta = []; this.bulkHorarioCargado = false; }
    });
  }

  /** true si el terapeuta atiende ese día de la semana (i: 0=Lunes..6=Domingo). Mientras no se
   *  haya cargado el horario (o no hay terapeuta elegido aún) no bloquea nada. */
  diaHabilitadoBulk(i: number): boolean {
    if (!this.bulkHorarioCargado) return true;
    return this.bulkHorarioTerapeuta.some(h => h.diaSemana === i + 1);
  }

  private franjasBulkDia(i: number): { horaInicio: string; horaFin: string }[] {
    return this.bulkHorarioTerapeuta
      .filter(h => h.diaSemana === i + 1)
      .map(h => ({ horaInicio: h.horaInicio, horaFin: h.horaFin }));
  }

  /** Horas puntuales donde cabe una sesión completa dentro del horario real de ese día — el paso
   *  entre opciones es igual a la duración de la sesión, para que nunca se solapen entre sí. */
  slotsDisponiblesBulkDia(i: number): string[] {
    const franjas = this.franjasBulkDia(i);
    if (franjas.length === 0) return [];
    return this.calcularSlotsDesdeFranjas(franjas, this.duracionSesion);
  }

  seleccionarSlotBulkDia(i: number, hora: string): void {
    this.bulkHoras[i] = hora;
    this.calcularBulkDates();
  }

  private calcularSlotsDesdeFranjas(franjas: { horaInicio: string; horaFin: string }[], duracionMin: number, paso?: number): string[] {
    duracionMin = Number(duracionMin);
    paso = paso ?? duracionMin;
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

  /** Desmarca los días que el terapeuta elegido no atiende, y si la hora ya elegida de un día
   *  activo ya no cabe en su horario real, la reemplaza por el primer slot disponible de ese día. */
  private ajustarBulkDiasSegunHorario(): void {
    for (let i = 0; i < 7; i++) {
      if (this.bulkDias[i] && !this.diaHabilitadoBulk(i)) { this.bulkDias[i] = false; continue; }
      if (!this.bulkDias[i]) continue;
      const slots = this.slotsDisponiblesBulkDia(i);
      if (slots.length > 0 && !slots.includes(this.bulkHoras[i])) this.bulkHoras[i] = slots[0];
    }
  }

  onBulkDiaToggle(i: number): void {
    if (this.bulkDias[i] && !this.bulkHoras[i]) this.bulkHoras[i] = '08:00';
    this.calcularBulkDates();
  }

  private readonly ESTADOS_FINALES = ['ASISTIDA', 'CANCELADA_PACIENTE', 'CANCELADA_CLINICA', 'NO_ASISTIO'];

  /** Cuántas sesiones del paquete ya tienen una cita creada. */
  get sesionesCreadasCount(): number {
    if (!this.editando) return 0;
    const ses = this.sesionesMap[this.editando.id!] || [];
    return ses.filter(s => s.citaActiva).length;
  }

  /** Cuántas sesiones le faltan por crear al paquete (ej. si subiste el total de sesiones). */
  get sesionesFaltantes(): number {
    return Math.max(0, (this.formData.sesionesTotal ?? 0) - this.sesionesCreadasCount);
  }

  /** Citas ya creadas que aún no pasaron y no están en un estado final — son las únicas que
   *  tiene sentido reprogramar (una cita ya atendida o cancelada no se debe tocar). */
  get citasFuturasReprogramables(): CitaResumen[] {
    if (!this.editando) return [];
    const ses = this.sesionesMap[this.editando.id!] || [];
    const ahora = new Date();
    return ses
      .filter(s => s.citaActiva && new Date(s.citaActiva.fechaInicio) > ahora && !this.ESTADOS_FINALES.includes(s.citaActiva.estado.key))
      .map(s => s.citaActiva!)
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
  }

  /** Calcula las fechas de las sesiones. Al crear un paquete usa "Fecha de inicio" + "Total de
   *  sesiones" del formulario; al editar usa la fecha elegida para la acción y la cantidad según
   *  si se están creando las sesiones faltantes o reprogramando las citas futuras. */
  calcularBulkDates(): void {
    this.bulkPreview = [];
    const fechaBase = this.editando ? this.bulkFechaDesdeEdicion : this.formData.fechaInicio;
    if (!fechaBase) return;
    const diasActivos = this.bulkDias.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const totalSesiones = this.editando
      ? (this.bulkAccionEdicion === 'reprogramar' ? this.citasFuturasReprogramables.length : this.sesionesFaltantes)
      : (this.formData.sesionesTotal ?? 0);
    if (diasActivos.length === 0 || totalSesiones < 1) return;

    const [y, mo, d] = fechaBase.split('-').map(Number);
    let cursor = new Date(y, mo - 1, d);
    let count = 0, tries = 0;
    while (count < totalSesiones && tries < 366) {
      tries++;
      const dow = (cursor.getDay() + 6) % 7; // 0=Lunes … 6=Domingo
      if (diasActivos.includes(dow)) {
        const [fH, fM] = (this.bulkHoras[dow] || '08:00').split(':').map(Number);
        const date = new Date(cursor);
        date.setHours(fH, fM, 0, 0);
        this.bulkPreview.push(date);
        count++;
      }
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
    this.cargarConflictosBulk();
  }

  /** Trae la disponibilidad real (fresca, sin caché) del terapeuta para todo el rango de fechas
   *  calculadas, y marca qué sesiones chocarían con su horario real o con otra cita ya agendada. */
  private cargarConflictosBulk(): void {
    const terapeutaId = this.formData.terapeutaId;
    if (!terapeutaId || this.bulkPreview.length === 0) { this.bulkConflictos = []; return; }
    const desde = this.fechaToISO(this.bulkPreview[0]);
    const hasta = this.fechaToISO(this.bulkPreview[this.bulkPreview.length - 1]);
    this.disponibilidadService.getSemana(terapeutaId, desde, hasta).subscribe({
      next: dias => {
        const dur = this.duracionSesion;
        this.bulkConflictos = this.bulkPreview.map(d => {
          const fecha = this.fechaToISO(d);
          const dia = dias.find(x => x.fecha === fecha);
          if (!dia) return true;
          const inicioMin = d.getHours() * 60 + d.getMinutes();
          const finMin = inicioMin + dur;
          return !dia.franjas.some(f => {
            const [fh, fm] = f.horaInicio.split(':').map(Number);
            const [th, tm] = f.horaFin.split(':').map(Number);
            return inicioMin >= fh * 60 + fm && finMin <= th * 60 + tm;
          });
        });
      },
      error: () => { this.bulkConflictos = []; }
    });
  }

  get bulkTieneConflictos(): boolean { return this.bulkConflictos.some(c => c); }
  get bulkTotalConflictos(): number { return this.bulkConflictos.filter(c => c).length; }

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
    this.formData.fechaInicio = this.fechaToISO(new Date());
    this.pac = this.emptyPac();
    this.tipoBusqueda = '';
    this.fAreaId = null;
    this.areaBusqueda = '';
    this.areaBusquedaTocado = false;
    this.fEspecialidadId = null;
    this.plantillaSeleccionadaId = null;
    this.plantillaBusqueda = '';
    this.pagoModo = 'pendiente';
    this.pagoMonto = null;
    this.pagoMetodoId = null;
    this.pagoReferencia = '';
    this.duracionSesionMin = null;
    this.bulkDias = [true, false, true, false, true, false, false];
    this.bulkHoras = ['08:00', '08:00', '08:00', '08:00', '08:00', '08:00', '08:00'];
    this.bulkPreview = [];
    this.bulkHorarioTerapeuta = [];
    this.bulkHorarioCargado = false;
    this.bulkConflictos = [];
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
      busquedaNombre: `${t.pacienteNombre ?? ''} ${t.pacienteApellido ?? ''}`.trim(),
      resultadosBusqueda: [], dropdownAbierto: false,
    };
    this.fEspecialidadId = tipo?.especialidad?.id ?? null;
    this.fAreaId = tipo?.area?.id ?? null;
    this.areaBusqueda = tipo?.area?.nombre ?? (this.areas.find(a => a.id === this.fAreaId)?.nombre ?? '');
    this.areaBusquedaTocado = false;
    this.tipoBusqueda = tipo?.nombre ?? '';
    this.ultimaSesionFecha = null;
    this.duracionSesionMin = tipo?.duracionMinutos ?? null;
    this.bulkAccionEdicion = 'crear';
    this.bulkFechaDesdeEdicion = this.fechaToISO(new Date());
    this.bulkDias = [true, false, true, false, true, false, false];
    this.bulkHoras = ['08:00', '08:00', '08:00', '08:00', '08:00', '08:00', '08:00'];
    this.bulkPreview = [];
    this.bulkConflictos = [];
    this.modalAbierto = true;

    const id = t.id!;
    // Se pide fresco cada vez que se abre — si se crearon o reprogramaron citas en una edición
    // anterior sin cerrar la página, no debe seguir mostrando el conteo viejo.
    this.cargandoUltimaSesion = true;
    this.tratamientoService.getSesiones(id).subscribe({
      next: ses => {
        this.sesionesMap[id] = ses;
        this.ultimaSesionFecha = this.computeUltimaSesion(ses);
        this.cargandoUltimaSesion = false;
        this.calcularBulkDates();
      },
      error: () => { this.cargandoUltimaSesion = false; }
    });
    this.onTerapeutaCambiadoParaHorario();
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
    if (!this.editando && this.bulkPreview.length === 0) {
      this.toast.warning('Programa el horario del paquete (elige terapeuta, fecha de inicio y al menos un día) — las citas se crean junto con el paquete.');
      return;
    }
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
        if (!esEdicion && this.bulkPreview.length > 0) {
          this.crearCitasDelPaquete(creado);
          return;
        }
        this.continuarDespuesDeGuardar(creado, esEdicion, 0);
      },
      error: () => { this.toast.error('Error al guardar el paquete'); this.guardando = false; }
    });
  }

  /** Crea de una vez todas las citas del horario programado, ya enganchadas a este paquete recién
   *  creado (mismo mecanismo que "Programar sesiones recurrentes" en Citas). Si el paquete ya
   *  quedó guardado, un fallo aquí no debe bloquear el flujo — solo se avisa. */
  private crearCitasDelPaquete(paquete: Tratamiento): void {
    const terapeuta = this.terapeutasTodos.find(t => t.id === this.formData.terapeutaId);
    const tipo = this.tipoSeleccionado;
    if (!terapeuta || !tipo?.key) { this.continuarDespuesDeGuardar(paquete, false, 0); return; }
    const dur = this.duracionSesion;
    const pacientePayload: PacienteEnCita = {
      id: this.pac.id ?? undefined,
      dni: this.pac.dni, nombre: this.pac.nombre, apellido: this.pac.apellido,
      telefono: this.pac.telefono || undefined, correo: this.pac.correo || undefined,
    };
    const toLocalDT = this.toLocalDT;
    // Se crean UNA POR UNA (no en paralelo): el backend numera cada sesión del paquete contando
    // cuántas ya existen, así que crear varias a la vez haría que dos lean el mismo número antes
    // de que la anterior confirme, chocando por sesión duplicada.
    from(this.bulkPreview).pipe(
      concatMap(fecha => this.citaService.crearConPaciente({
        paciente: pacientePayload,
        paciente2: null,
        terapeutaNombre: nombreDeTerapeuta(terapeuta),
        tipoKey: tipo.key!,
        fechaInicio: toLocalDT(fecha),
        duracionMinutos: dur,
        estadoKey: 'PROGRAMADA',
        modalidadKey: 'PRESENCIAL',
        totalSesionesPlan: this.formData.sesionesTotal ?? undefined,
        precioPorSesion: this.formData.precioPorSesion ?? undefined,
        tratamientoId: paquete.id!,
        tipoRecurrencia: 'FIJO',
      }).pipe(
        // Si una fecha puntual falla (ej. conflicto real de horario), no se aborta el resto —
        // se sigue con las demás y se cuenta cuántas sí se lograron crear.
        map(r => ({ ok: true as const, r })),
        catchError(() => of({ ok: false as const }))
      )),
      toArray()
    ).subscribe(resultados => {
      const exitosas = resultados.filter(r => r.ok).length;
      if (exitosas < resultados.length) {
        this.toast.warning(`Se crearon ${exitosas} de ${resultados.length} citas — las demás tenían conflicto de horario, créalas desde Citas.`);
      }
      this.continuarDespuesDeGuardar(paquete, false, exitosas);
    });
  }

  private toLocalDT(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
  }

  // ── Editar paquete: crear sesiones faltantes o reprogramar citas futuras ─────

  aplicarHorarioEdicion(): void {
    if (!this.editando || this.bulkPreview.length === 0 || this.aplicandoHorarioEdicion) return;
    const terapeuta = this.terapeutasTodos.find(t => t.id === this.formData.terapeutaId);
    const tipo = this.tipoSeleccionado;
    if (!terapeuta || !tipo?.key) { this.toast.warning('Elige terapeuta y tipo de terapia primero.'); return; }
    this.aplicandoHorarioEdicion = true;
    if (this.bulkAccionEdicion === 'crear') {
      this.crearSesionesFaltantes(terapeuta, tipo);
    } else {
      this.reprogramarCitasFuturas(terapeuta, tipo);
    }
  }

  /** Crea, una por una, las sesiones que le faltan al paquete según el horario elegido. */
  private crearSesionesFaltantes(terapeuta: Terapeuta, tipo: CatalogItem): void {
    const dur = this.duracionSesion;
    const pacientePayload: PacienteEnCita = {
      id: this.pac.id ?? undefined,
      dni: this.pac.dni, nombre: this.pac.nombre, apellido: this.pac.apellido,
      telefono: this.pac.telefono || undefined, correo: this.pac.correo || undefined,
    };
    from(this.bulkPreview).pipe(
      concatMap(fecha => this.citaService.crearConPaciente({
        paciente: pacientePayload,
        paciente2: null,
        terapeutaNombre: nombreDeTerapeuta(terapeuta),
        tipoKey: tipo.key!,
        fechaInicio: this.toLocalDT(fecha),
        duracionMinutos: dur,
        estadoKey: 'PROGRAMADA',
        modalidadKey: 'PRESENCIAL',
        precioPorSesion: this.formData.precioPorSesion ?? undefined,
        tratamientoId: this.editando!.id!,
        tipoRecurrencia: 'FIJO',
      }).pipe(map(() => ({ ok: true as const })), catchError(() => of({ ok: false as const })))),
      toArray()
    ).subscribe(resultados => {
      const exitosas = resultados.filter(r => r.ok).length;
      this.aplicandoHorarioEdicion = false;
      if (exitosas > 0) this.toast.success(`${exitosas} sesión${exitosas === 1 ? '' : 'es'} creada${exitosas === 1 ? '' : 's'} correctamente`);
      if (exitosas < resultados.length) this.toast.warning(`${resultados.length - exitosas} no se pudieron crear por conflicto de horario.`);
      this.recargarSesionesEdicion();
    });
  }

  /** Reprograma, una por una, las citas futuras ya creadas (que aún no se atendieron ni se
   *  cancelaron) a las nuevas fechas calculadas — en el mismo orden en que ya estaban. */
  private reprogramarCitasFuturas(terapeuta: Terapeuta, tipo: CatalogItem): void {
    const dur = this.duracionSesion;
    const pares = this.citasFuturasReprogramables
      .slice(0, this.bulkPreview.length)
      .map((cita, i) => ({ cita, nuevaFecha: this.bulkPreview[i] }));
    from(pares).pipe(
      concatMap(({ cita, nuevaFecha }) => this.citaService.actualizarCitaLocal(String(cita.id), {
        terapeuta_id: terapeuta.id!,
        paciente_id: this.pac.id ?? undefined,
        // El PUT valida estado/modalidad como FK obligatorias — se mantienen las que ya
        // tenía la cita, solo cambia la fecha.
        estado_id: this.estadosCita.find(e => e.key === cita.estado.key)?.id,
        modalidad_id: this.modalidadesCita.find(m => m.key === (cita.modalidad?.key || 'PRESENCIAL'))?.id,
        fecha_inicio: nuevaFecha,
        duracion_minutos: dur,
        terapeuta_nombre: nombreDeTerapeuta(terapeuta),
        tipo_key: tipo.key!,
        tipo_nombre: tipo.nombre,
        estado_key: cita.estado.key,
        modalidad_key: cita.modalidad?.key || 'PRESENCIAL',
        paciente_nombre: this.pac.nombre,
        paciente_apellido: this.pac.apellido,
      } as CrearCitaLocalRequest).pipe(map(() => ({ ok: true as const })), catchError(() => of({ ok: false as const })))),
      toArray()
    ).subscribe(resultados => {
      const exitosas = resultados.filter(r => r.ok).length;
      this.aplicandoHorarioEdicion = false;
      if (exitosas > 0) this.toast.success(`${exitosas} cita${exitosas === 1 ? '' : 's'} reprogramada${exitosas === 1 ? '' : 's'} correctamente`);
      if (exitosas < resultados.length) this.toast.warning(`${resultados.length - exitosas} no se pudieron reprogramar.`);
      this.recargarSesionesEdicion();
    });
  }

  /** Refresca sesiones/conteos tras crear o reprogramar — para que "sesiones faltantes" y
   *  "citas reprogramables" reflejen el nuevo estado real, sin quedarse con el conteo viejo. */
  private recargarSesionesEdicion(): void {
    if (!this.editando) return;
    const id = this.editando.id!;
    this.tratamientoService.getSesiones(id).subscribe(ses => {
      this.sesionesMap[id] = ses;
      this.ultimaSesionFecha = this.computeUltimaSesion(ses);
      this.calcularBulkDates();
    });
    this.cargar();
  }

  /** Los pagos digitales dejan un n° de operación que hay que poder anotar; el efectivo no.
   *  Mismo criterio que en Citas. */
  metodoRequiereReferencia(metodoId: number | null): boolean {
    const nombre = this.metodosPago.find(m => m.id === metodoId)?.nombre?.toLowerCase() ?? '';
    return nombre.includes('yape') || nombre.includes('plin')
        || nombre.includes('transferencia') || nombre.includes('tarjeta');
  }

  /** Último paso común tras crear/actualizar el paquete (y, si correspondía, sus citas): registra
   *  el pago inicial si se eligió uno, y cierra el modal mostrando el resumen final. */
  private continuarDespuesDeGuardar(paquete: Tratamiento, esEdicion: boolean, citasCreadas: number): void {
    if (!esEdicion && this.pagoModo !== 'pendiente') {
      this.registrarPagoInicial(paquete, citasCreadas);
      return;
    }
    const msg = esEdicion
      ? 'Paquete actualizado correctamente'
      : citasCreadas > 0
        ? `Paquete creado con ${citasCreadas} cita${citasCreadas === 1 ? '' : 's'} programada${citasCreadas === 1 ? '' : 's'}`
        : 'Paquete creado correctamente';
    this.toast.success(msg);
    this.cerrarModal(); this.cargar(); this.guardando = false;
  }

  /** Registra el pago inicial elegido en el modal contra el paquete recién creado — el paquete
   *  ya quedó guardado, así que un fallo aquí no debe bloquear el flujo, solo avisar. */
  private registrarPagoInicial(paquete: Tratamiento, citasCreadas: number): void {
    const monto = this.pagoModo === 'completo' ? this.montoTotalPaquete : (this.pagoMonto ?? 0);
    const sufijoCitas = citasCreadas > 0 ? ` y ${citasCreadas} cita${citasCreadas === 1 ? '' : 's'} programada${citasCreadas === 1 ? '' : 's'}` : '';
    this.pagoService.create({
      tratamiento: { id: paquete.id! } as any,
      paciente: { id: this.formData.pacienteId! } as any,
      metodo: { id: this.pagoMetodoId! } as any,
      montoRecibido: monto,
      ...(this.pagoReferencia.trim() ? { referencia: this.pagoReferencia.trim() } : {}),
    }).subscribe({
      next: () => {
        this.toast.success(`Paquete creado, pago registrado${sufijoCitas} correctamente`);
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => {
        this.toast.warning(`El paquete se creó${sufijoCitas}, pero el pago no se pudo registrar — regístralo desde Pagos.`);
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
