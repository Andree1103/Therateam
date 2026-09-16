import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PacienteService } from '../../Services/paciente.service';
import { TratamientoService } from '../../../tratamientos/Services/tratamiento.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { CitaService } from '../../../citas/Services/cita.service';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { Paciente, SaldoMovimiento } from '../../Models/paciente.model';
import { Tratamiento } from '../../../tratamientos/Models/tratamiento.model';
import { Pago } from '../../../pagos/Models/pago.model';
import { Cita } from '../../../citas/Models/cita.model';
import { AtencionClinica, camposDeLaFicha, resumenAtencion } from '../../../atencion-clinica/Models/atencion.model';
import { AuthService } from '../../../auth/Services/auth.service';
import { HistoriaClinicaService } from '../../../historia-clinica/Services/historia.service';
import { HcCampo, HcPlantilla, HistoriaClinica } from '../../../historia-clinica/Models/historia.model';
import { ArchivoService, Archivo } from '../../../../core/services/archivo.service';
import { CatalogService } from '../../../../core/services/catalog.service';

type TabPerfilKey = 'datos' | 'historia' | 'tratamientos' | 'citas' | 'atenciones' | 'pagos' | 'saldo';

@Component({
  selector: 'app-perfil-paciente',
  templateUrl: './perfil-paciente.component.html',
  styleUrls: ['./perfil-paciente.component.css']
})
export class PerfilPacienteComponent implements OnInit {
  /** Exportar a Excel se habilita por ROL (Seguridad > Roles). */
  get puedeExportar(): boolean { return this.authService.puedeExportar(); }


  loading = true;
  paciente: Paciente | null = null;
  tratamientos: Tratamiento[] = [];
  citas: Cita[] = [];
  atenciones: AtencionClinica[] = [];
  pagos: Pago[] = [];
  tabActivo: TabPerfilKey = 'datos';

  // ── Estado de cuenta del saldo a favor ────────────────────────────────────
  // Vive aqui ademas de en Adelantos porque ese listado solo muestra a quien tiene
  // saldo > 0: al gastarlo entero, el historial dejaba de ser alcanzable.
  movimientosSaldo: SaldoMovimiento[] = [];
  cargandoSaldo = false;

  get saldoIngresado(): number {
    return this.movimientosSaldo.filter(m => m.monto > 0).reduce((a, m) => a + m.monto, 0);
  }
  get saldoUsado(): number {
    return this.movimientosSaldo.filter(m => m.monto < 0).reduce((a, m) => a - m.monto, 0);
  }

  private pacienteId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pacienteService: PacienteService,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService,
    private citaService: CitaService,
    private atencionService: AtencionClinicaService,
    private excelExportService: ExcelExportService,
    private toast: ToastService
  ,
    private authService: AuthService,
    private historiaService: HistoriaClinicaService,
    private archivoService: ArchivoService,
    private catalogService: CatalogService) {}

  // ── Historia clínica ───────────────────────────────────────────────────────
  // Los campos los define una plantilla configurable (Configuraciones > Historia clínica),
  // no están fijos en el código: por eso el formulario se arma en tiempo de ejecución y los
  // valores viven en un diccionario {clave: valor} en vez de propiedades del componente.

  get puedeVerHistoria(): boolean { return this.authService.puedeVerHistoria(); }
  get puedeEditarHistoria(): boolean { return this.authService.puedeEditarHistoria(); }

  plantillasHc: HcPlantilla[] = [];
  historiasHc: HistoriaClinica[] = [];
  plantillaHcId: number | null = null;
  valoresHc: Record<string, any> = {};
  cargandoHc = false;
  guardandoHc = false;
  /** Adjuntos de la ficha que se está viendo. */
  archivosHc: Archivo[] = [];
  miniaturasHc = new Map<number, string>();
  subiendoHc = false;
  maxMbHc = 10;

  /**
   * Ids de los tipos de terapia en los que este paciente tiene citas.
   *
   * Se resuelven cruzando la KEY que trae la cita con el catálogo: el DTO de cita no manda el
   * id del tipo de terapia (el front le pone 1 por defecto), así que filtrar por ese id daría
   * siempre el mismo resultado sin que se note.
   */
  private tiposTerapiaDelPaciente = new Set<number>();
  /** El usuario puede pedir ver todas las fichas, no solo las de sus disciplinas. */
  mostrarTodasLasFichas = false;

  /**
   * Fichas que tiene sentido ofrecer para este paciente: las genéricas, las de las disciplinas
   * en las que se atiende, y las que ya tienen datos cargados (una ficha con contenido no se
   * esconde aunque el paciente ya no tenga citas de ese tipo).
   */
  get plantillasHcVisibles(): HcPlantilla[] {
    if (this.mostrarTodasLasFichas) return this.plantillasHc;
    return this.plantillasHc.filter(p =>
      !p.tipoTerapia
      || this.tiposTerapiaDelPaciente.has(p.tipoTerapia.id)
      || this.historiasHc.some(h => h.plantilla?.id === p.id));
  }

  /** Cuántas quedan fuera del filtro — para ofrecer verlas sin sorprender al usuario. */
  get fichasOcultas(): number {
    return this.plantillasHc.length - this.plantillasHcVisibles.length;
  }

  alternarTodasLasFichas(): void {
    this.mostrarTodasLasFichas = !this.mostrarTodasLasFichas;
  }

  private cargarHistoria(): void {
    if (!this.puedeVerHistoria || !this.paciente?.id) return;
    this.cargandoHc = true;
    // Las disciplinas del paciente salen de sus citas, cruzando la key con el catálogo.
    this.catalogService.getTiposTerapia().subscribe({
      next: tipos => {
        const keysDelPaciente = new Set(
          this.citas.map(c => (c.tipo_terapia_key ?? '').toUpperCase()).filter(k => k));
        this.tiposTerapiaDelPaciente = new Set(
          tipos.filter(t => keysDelPaciente.has((t.key ?? '').toUpperCase())).map(t => t.id));
        this.ajustarFichaSeleccionada();
      },
      error: () => {}
    });
    forkJoin({
      // Solo las de HISTORIA: las de ATENCION se usan en el modal de la sesión, no acá.
      plantillas: this.historiaService.getPlantillas('HISTORIA').pipe(catchError(() => of([] as HcPlantilla[]))),
      historias: this.historiaService.getHistorias(this.paciente.id).pipe(catchError(() => of([] as HistoriaClinica[]))),
    }).subscribe(({ plantillas, historias }) => {
      this.plantillasHc = plantillas;
      this.historiasHc = historias;
      // Arranca en la ficha que el paciente ya tenga; si no tiene ninguna, en la primera plantilla.
      this.plantillaHcId = historias[0]?.plantilla?.id ?? plantillas[0]?.id ?? null;
      this.ajustarFichaSeleccionada();
      this.cargarValoresHc();
      this.cargandoHc = false;
    });
    this.archivoService.maxMb().subscribe({ next: mb => this.maxMbHc = mb, error: () => {} });
  }

  /** La plantilla elegida en el selector (la que se está pintando). */
  get plantillaHc(): HcPlantilla | null {
    return this.plantillasHc.find(p => p.id === this.plantillaHcId) ?? null;
  }

  /** La ficha guardada para esa plantilla, si el paciente ya la tiene. */
  get historiaHc(): HistoriaClinica | null {
    return this.historiasHc.find(h => h.plantilla?.id === this.plantillaHcId) ?? null;
  }

  onPlantillaHcChange(): void { this.cargarValoresHc(); }

  /** Si la ficha elegida quedó fuera del filtro, se pasa a la primera visible. */
  private ajustarFichaSeleccionada(): void {
    const visibles = this.plantillasHcVisibles;
    if (visibles.length === 0) return;
    if (!visibles.some(p => p.id === this.plantillaHcId)) {
      this.plantillaHcId = visibles[0].id ?? null;
      this.cargarValoresHc();
    }
  }

  private cargarValoresHc(): void {
    const guardada = this.historiaHc;
    // Copia: se edita el borrador, no el objeto que vino del backend.
    this.valoresHc = guardada ? { ...(guardada.datos ?? {}) } : {};
    // MULTISELECT necesita un array aunque esté vacío, o el checkbox no sabe qué marcar.
    this.plantillaHc?.secciones.forEach(sec => sec.campos.forEach(c => {
      if (c.tipo === 'MULTISELECT' && !Array.isArray(this.valoresHc[c.clave])) {
        this.valoresHc[c.clave] = this.valoresHc[c.clave] ? [this.valoresHc[c.clave]] : [];
      }
    }));
    this.cargarArchivosHc();
  }

  /** Marca o desmarca una opción de un campo de selección múltiple. */
  toggleOpcionHc(campo: HcCampo, opcion: string, marcada: boolean): void {
    const actuales: string[] = Array.isArray(this.valoresHc[campo.clave]) ? this.valoresHc[campo.clave] : [];
    this.valoresHc[campo.clave] = marcada
      ? [...actuales.filter(o => o !== opcion), opcion]
      : actuales.filter(o => o !== opcion);
  }

  opcionMarcadaHc(campo: HcCampo, opcion: string): boolean {
    const v = this.valoresHc[campo.clave];
    return Array.isArray(v) && v.includes(opcion);
  }

  guardarHistoria(): void {
    if (!this.paciente?.id || !this.plantillaHcId) return;
    this.guardandoHc = true;
    this.historiaService.guardar(this.paciente.id, this.plantillaHcId, this.valoresHc).subscribe({
      next: guardada => {
        // Reemplaza la ficha en la lista (o la agrega si era la primera vez).
        const i = this.historiasHc.findIndex(h => h.plantilla?.id === this.plantillaHcId);
        if (i >= 0) this.historiasHc[i] = guardada; else this.historiasHc.push(guardada);
        this.valoresHc = { ...(guardada.datos ?? {}) };
        this.cargarValoresHc();
        this.toast.success('Historia clínica guardada');
        this.guardandoHc = false;
      },
      error: err => {
        this.toast.error(err?.error?.error || 'No se pudo guardar la historia clínica');
        this.guardandoHc = false;
      }
    });
  }

  // ── Adjuntos de la ficha ──────────────────────────────────────────────────

  private cargarArchivosHc(): void {
    const h = this.historiaHc;
    this.archivosHc = [];
    if (!h?.id) return;
    this.archivoService.listar('HISTORIA', h.id).subscribe({
      next: lista => {
        this.archivosHc = lista;
        lista.filter(a => a.esImagen).forEach(a => this.cargarMiniaturaHc(a));
      },
      error: () => {}
    });
  }

  private cargarMiniaturaHc(a: Archivo): void {
    if (this.miniaturasHc.has(a.id)) return;
    this.archivoService.contenidoUrl(a.id).subscribe({
      next: url => this.miniaturasHc.set(a.id, url),
      error: () => {}
    });
  }

  miniaturaHc(a: Archivo): string | null { return this.miniaturasHc.get(a.id) ?? null; }
  tamanoArchivo(bytes: number): string { return this.archivoService.formatoTamano(bytes); }

  onArchivosHcElegidos(e: Event): void {
    const input = e.target as HTMLInputElement;
    const elegidos = Array.from(input.files ?? []);
    input.value = '';
    const h = this.historiaHc;
    if (!h?.id) { this.toast.warning('Guarda la ficha antes de adjuntar archivos'); return; }

    const validos = elegidos.filter(f => f.size <= this.maxMbHc * 1024 * 1024);
    if (validos.length < elegidos.length) this.toast.warning(`Algún archivo supera los ${this.maxMbHc} MB`);
    if (validos.length === 0) return;

    this.subiendoHc = true;
    let pendientes = validos.length;
    validos.forEach(f => {
      this.archivoService.subir('HISTORIA', h.id!, f).subscribe({
        next: a => {
          this.archivosHc.push(a);
          if (a.esImagen) this.cargarMiniaturaHc(a);
          if (--pendientes === 0) this.subiendoHc = false;
        },
        error: err => {
          this.toast.error(err?.error?.error || `No se pudo subir "${f.name}"`);
          if (--pendientes === 0) this.subiendoHc = false;
        }
      });
    });
  }

  eliminarArchivoHc(a: Archivo): void {
    if (!confirm(`¿Eliminar "${a.nombreOriginal}"?`)) return;
    this.archivoService.eliminar(a.id).subscribe({
      next: () => {
        this.archivosHc = this.archivosHc.filter(x => x.id !== a.id);
        const url = this.miniaturasHc.get(a.id);
        if (url) { URL.revokeObjectURL(url); this.miniaturasHc.delete(a.id); }
        this.toast.success('Archivo eliminado');
      },
      error: () => this.toast.error('No se pudo eliminar el archivo')
    });
  }

  abrirArchivoHc(a: Archivo): void {
    const ya = this.miniaturasHc.get(a.id);
    if (ya) { window.open(ya, '_blank'); return; }
    this.archivoService.contenidoUrl(a.id).subscribe({
      next: url => window.open(url, '_blank'),
      error: () => this.toast.error('No se pudo abrir el archivo')
    });
  }

  ngOnInit(): void {
    this.pacienteId = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    forkJoin({
      paciente:     this.pacienteService.getById(this.pacienteId),
      tratamientos: this.tratamientoService.getByPaciente(this.pacienteId).pipe(catchError(() => of([] as Tratamiento[]))),
      pagos:        this.pagoService.getByPaciente(this.pacienteId).pipe(catchError(() => of([] as Pago[]))),
      citas:        this.citaService.getByPaciente(this.pacienteId).pipe(catchError(() => of([] as Cita[]))),
      saldo:        this.pacienteService.getSaldoMovimientos(this.pacienteId).pipe(catchError(() => of([] as SaldoMovimiento[]))),
    }).subscribe({
      next: ({ paciente, tratamientos, pagos, citas, saldo }) => {
        this.movimientosSaldo = saldo;
        this.paciente     = paciente;
        this.tratamientos = tratamientos;
        this.pagos        = pagos;
        this.citas        = citas;
        this.loading = false;
        this.cargarAtenciones();
        this.cargarHistoria();
      },
      error: () => { this.loading = false; this.toast.error('Error al cargar el perfil'); }
    });
  }

  /**
   * Atenciones registradas para las citas de este paciente (una cita atendida se convierte en
   * atención). Una sola petición: antes se preguntaba cita por cita, así que abrir el perfil de
   * alguien con 60 citas disparaba 60 llamadas y las 404 de las que no tenían atención se veían
   * como errores en la consola.
   */
  private cargarAtenciones(): void {
    if (this.citas.length === 0) { this.atenciones = []; return; }
    const idsVisibles = new Set(this.citas.map(c => Number(c.id)));
    this.atencionService.getByPaciente(this.pacienteId)
      .pipe(catchError(() => of([] as AtencionClinica[])))
      .subscribe(resultados => {
        // El endpoint devuelve las atenciones de todas sus citas; la pantalla solo sabe mostrar
        // las de las citas que tiene cargadas (una anulada, por ejemplo, ya no aparece en la
        // tabla y su fila quedaría sin fecha ni terapeuta).
        this.atenciones = resultados.filter(a => idsVisibles.has(Number(a.citaId)));
      });
  }

  /**
   * El DTO de Cita que consume esta pantalla trae solo la key del estado (PROGRAMADA,
   * CANCELADA_CLINICA...), no su nombre. Se traduce aca para que ni la tabla ni el Excel
   * muestren el identificador crudo.
   */
  estadoCitaLabel(key?: string | null): string {
    const etiquetas: Record<string, string> = {
      PROGRAMADA: 'Programada',
      CONFIRMADA: 'Confirmada',
      EN_CURSO: 'En curso',
      ASISTIDA: 'Asistida',
      NO_ASISTIO: 'No asistió',
      REPROGRAMADA: 'Reprogramada',
      CANCELADA_PACIENTE: 'Cancelada por paciente',
      CANCELADA_CLINICA: 'Cancelada por clínica',
    };
    return key ? (etiquetas[key] ?? key) : '';
  }

  /**
   * El catálogo manda un color pleno, pensado para texto. Como fondo del chip resulta ilegible,
   * así que se usa el mismo color al 15% y el texto va en el color pleno.
   */
  colorPagoFondo(color?: string | null): string {
    return color ? `${color}26` : '#f1f5f9';
  }

  /** Tooltip de la columna Pago: cuánto se cubrió del precio, que es la pregunta que sigue
   *  cuando una cita aparece como parcial. */
  detallePago(c: Cita): string {
    if (c.precio == null) return c.estado_pago_nombre ?? '';
    const pagado = c.monto_pagado ?? 0;
    return `Pagado S/ ${pagado.toFixed(2)} de S/ ${c.precio.toFixed(2)}`;
  }

  // ── Exportar el historial del paciente ────────────────────────────────────

  exportando = false;

  /**
   * Un solo archivo con el historial completo del paciente: citas, atenciones y pagos, cada
   * uno en su hoja. Sale de lo que ya esta cargado en pantalla, asi que no vuelve a pedir nada.
   *
   * Las atenciones se cruzan con su cita para poder mostrar fecha, terapeuta y tipo de terapia:
   * la atencion sola solo guarda el citaId.
   */
  exportarHistorial(): void {
    if (!this.paciente) return;
    this.exportando = true;

    const f = (v?: string | Date | null) => v ? new Date(v).toLocaleString('es-PE') : '';
    const soloFecha = (v?: string | Date | null) => v ? new Date(v).toLocaleDateString('es-PE') : '';
    const citaDe = (citaId: number) => this.citas.find(c => Number(c.id) === Number(citaId));

    const datos = [{
      'Paciente': `${this.paciente.nombre} ${this.paciente.apellido}`,
      'DNI': this.paciente.dni ?? '',
      'Teléfono': this.paciente.telefono ?? '',
      'Correo': this.paciente.correo ?? '',
      'Fecha de nacimiento': soloFecha(this.paciente.fechaNacimiento),
      'Paquetes': this.tratamientos.length,
      'Citas': this.citas.length,
      'Atenciones': this.atenciones.length,
      'Pagos': this.pagos.length,
      'Deuda total (S/)': this.deudaTotal,
      'Saldo a favor (S/)': this.paciente.saldoAFavor ?? 0,
    }];

    const citas = this.citas.map(c => ({
      'Fecha': f(c.fecha_inicio),
      'Duración (min)': c.duracion_minutos ?? '',
      'Terapeuta': c.terapeuta_nombre ?? '',
      'Tipo de terapia': c.tipo_terapia_nombre ?? '',
      'Modalidad': c.modalidad ?? '',
      'Estado': this.estadoCitaLabel(c.estado),
      'Estado de pago': c.estado_pago_nombre ?? '',
      'Medio de pago': c.metodo_pago_nombre ?? '',
      'Precio (S/)': c.precio ?? '',
      'Pagado (S/)': c.monto_pagado ?? '',
      'Paquete': c.tratamiento_nombre ?? '',
      'Observación': c.observacion ?? '',
    }));

    const atenciones = this.atenciones.map(a => {
      const c = citaDe(a.citaId);
      return {
        'Fecha de atención': f(a.fechaInicioReal),
        'Fecha de la cita': f(c?.fecha_inicio),
        'Terapeuta': c?.terapeuta_nombre ?? '',
        'Tipo de terapia': c?.tipo_terapia_nombre ?? '',
        'Medio de pago': c?.metodo_pago_nombre ?? '',
        'Duración real (min)': a.duracionRealMin ?? '',
        'Métricas': (a.metricas ?? [])
          .filter(m => m.valor != null)
          .map(m => `${m.metrica}: ${m.valor}${m.unidad ?? ''}`).join(' · '),
        // La ficha configurable va en una sola columna: sus campos cambian por tipo de
        // terapia, asi que no se pueden fijar como columnas del Excel.
        'Ficha de la atención': camposDeLaFicha(a).map(p => `${p.etiqueta}: ${p.valor}`).join(' · '),
        'S · Subjetivo': a.subjetivo ?? '',
        'O · Objetivo': a.objetivo ?? '',
        'A · Análisis': a.analisis ?? '',
        'P · Plan': a.plan ?? '',
        'Observaciones': a.notasPost ?? '',
      };
    });

    const pagos = this.pagos.map(p => ({
      'Fecha': f(p.fechaPago),
      'Concepto': p.concepto ?? p.tratamiento?.nombre ?? '',
      'Terapeuta': p.tratamiento?.terapeutaNombre ?? '',
      'Tipo de terapia': p.tratamiento?.tipoTerapiaNombre ?? '',
      'Método': p.metodo?.nombre ?? '',
      'N° de operación': p.referencia ?? '',
      'Recibido (S/)': p.montoRecibido ?? 0,
      'Aplicado (S/)': p.montoAplicado ?? 0,
      'Saldo generado (S/)': p.saldoGenerado ?? 0,
      'Tipo': p.esDevolucion ? 'Devolución' : (p.esAdicional ? 'Cobro adicional' : 'Pago'),
      'Registró': p.usuarioCreacionNombre ?? '',
    }));

    const saldo = this.movimientosSaldo.map(m => ({
      'Fecha': f(m.fecha),
      'Concepto': m.motivo ?? '',
      'Terapeuta': m.terapeutaNombre ?? '',
      'Movimiento (S/)': m.monto,
      'Saldo resultante (S/)': m.saldoResultante,
    }));

    const nombreArchivo = `paciente_${(this.paciente.dni || this.paciente.apellido || 'historial')}`
      .replace(/[^A-Za-z0-9_-]/g, '');

    this.excelExportService.exportarLibro([
      { nombre: 'Resumen', filas: datos },
      { nombre: 'Citas', filas: citas },
      { nombre: 'Atenciones', filas: atenciones },
      { nombre: 'Pagos', filas: pagos },
      { nombre: 'Saldo a favor', filas: saldo },
    ], nombreArchivo);

    this.exportando = false;
    this.toast.success('Historial exportado');
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────

  get deudaTotal(): number {
    return this.tratamientos.reduce((acc, t) => acc + this.deudaTratamiento(t), 0);
  }

  get iniciales(): string {
    return ((this.paciente?.nombre?.[0] ?? '') + (this.paciente?.apellido?.[0] ?? '')).toUpperCase();
  }

  get edad(): string {
    if (!this.paciente?.fechaNacimiento) return '—';
    const nac = new Date(this.paciente.fechaNacimiento);
    const hoy = new Date();
    const anos = hoy.getFullYear() - nac.getFullYear() -
      (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate()) ? 1 : 0);
    return `${anos} años`;
  }

  get esMenorDeEdad(): boolean {
    if (!this.paciente?.fechaNacimiento) return false;
    const nac = new Date(this.paciente.fechaNacimiento);
    const hoy = new Date();
    const anos = hoy.getFullYear() - nac.getFullYear() -
      (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate()) ? 1 : 0);
    return anos < 18;
  }

  // ── Helpers de formato ────────────────────────────────────────────────────

  formatFecha(f?: string | Date): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatFechaHora(f?: string | Date): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  estadoTratamiento(t: Tratamiento): string {
    return t.estadoNombre ?? '—';
  }

  /** Deuda del paquete: precio total del paquete menos lo ya cobrado (no depende de asistencia). */
  deudaTratamiento(t: Tratamiento): number {
    const montoTotal = t.montoTotal ?? 0;
    const cobrado     = t.totalCobrado ?? 0;
    return Math.max(0, montoTotal - cobrado);
  }

  estadoColor(key?: string): string {
    const map: Record<string, string> = {
      ACTIVO: '#22C55E', COMPLETADO: '#3B82F6', PAUSADO: '#94A3B8',
      CANCELADO: '#EF4444', DEUDA: '#F97316',
    };
    return map[key ?? ''] ?? '#94a3b8';
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  citaDeAtencion(a: AtencionClinica): Cita | undefined {
    return this.citas.find(c => Number(c.id) === a.citaId);
  }

  /**
   * Una linea con lo que tenga la atencion, para la celda de la tabla (el detalle completo se
   * ve en Atenciones). Cubre los tres formatos que conviven: la ficha configurable, el SOAP y
   * la nota libre de las atenciones mas viejas.
   */
  resumenSoap(a: AtencionClinica): string {
    return resumenAtencion(a);
  }

  volver(): void { this.router.navigate(['/pacientes']); }
  irTratamiento(id?: number): void { if (id) this.router.navigate(['/tratamientos', id]); }
}
