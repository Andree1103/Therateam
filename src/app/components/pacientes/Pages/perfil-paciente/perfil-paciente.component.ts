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
import { AtencionClinica } from '../../../atencion-clinica/Models/atencion.model';
import { AuthService } from '../../../auth/Services/auth.service';
import { HorarioFijo, DIAS_SEMANA, DIAS_CORTOS, soloHoraYMinuto, nombreTerapeutaDeHorario }
  from '../../Models/horario-fijo.model';

type TabPerfilKey = 'datos' | 'tratamientos' | 'citas' | 'atenciones' | 'pagos' | 'saldo';

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
    private authService: AuthService) {}

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
      horarios:     this.pacienteService.getHorariosFijos(this.pacienteId).pipe(catchError(() => of([] as HorarioFijo[]))),
    }).subscribe({
      next: ({ paciente, tratamientos, pagos, citas, saldo, horarios }) => {
        this.movimientosSaldo = saldo;
        this.horariosFijos = horarios;
        this.paciente     = paciente;
        this.tratamientos = tratamientos;
        this.pagos        = pagos;
        this.citas        = citas;
        this.loading = false;
        this.cargarAtenciones();
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

  // ── Horario fijo ──────────────────────────────────────────────────────────
  // Se edita desde el modal de Pacientes; aquí solo se muestra, que es lo que se busca al abrir
  // la ficha: saber de un vistazo cuándo suele venir.

  horariosFijos: HorarioFijo[] = [];

  /** Agrupados por terapia, igual que en el modal: es como se lee el horario de un paciente. */
  horariosPorTerapia(): { nombre: string; items: HorarioFijo[] }[] {
    const grupos = new Map<string, HorarioFijo[]>();
    for (const h of this.horariosFijos) {
      const clave = h.tipoTerapia?.nombre ?? 'Sin terapia definida';
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(h);
    }
    return [...grupos.entries()]
      .map(([nombre, items]) => ({
        nombre,
        items: items.sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio)),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * Cuantas veces no vino, y cuanto se le devolvio por eso.
   *
   * Va en la cabecera junto a paquetes y deuda porque es lo que se mira antes de agendarle otra
   * vez: tres inasistencias seguidas cambian la conversacion con el paciente.
   */
  get inasistencias(): Cita[] {
    return this.citas.filter(c => c.estado === 'NO_ASISTIO');
  }

  get devueltoPorInasistencias(): number {
    return this.inasistencias.reduce((t, c) => t + (c.con_devolucion ? (c.monto_devuelto ?? 0) : 0), 0);
  }

  diaCorto(d: number): string { return DIAS_CORTOS[d]; }
  soloHora(h?: string | null): string { return soloHoraYMinuto(h); }
  terapeutaDeHorario(h: HorarioFijo): string { return nombreTerapeutaDeHorario(h); }

  /** Minutos del horario, cuando quedó anotada la hora de fin. */
  duracionHorario(h: HorarioFijo): number | null {
    if (!h.horaFin) return null;
    const min = (t: string) => { const [a, b] = soloHoraYMinuto(t).split(':').map(Number); return a * 60 + (b || 0); };
    const d = min(h.horaFin) - min(h.horaInicio);
    return d > 0 ? d : null;
  }

  /**
   * El DTO de Cita que consume esta pantalla trae solo la key del estado (PROGRAMADA,
   * ANULADA...), no su nombre. Se traduce aca para que ni la tabla ni el Excel
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
      ANULADA: 'Anulada',
      // Retirados: quedan traducidos por si alguna cita vieja no se migro.
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
      'Cita #': c.id,
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
      'Motivo (anulada/reprogramada)': c.motivo_estado ?? '',
      'Viene de la cita #': c.reprogramacion_de ?? '',
      'Se movió a la cita #': c.reprogramada_en ?? '',
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
        'Notas': a.notasPost ?? '',
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
      { nombre: 'Horario fijo', filas: this.horariosFijos
          .slice()
          .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
          .map(h => ({
            'Día': DIAS_SEMANA[h.diaSemana],
            'Hora inicio': this.soloHora(h.horaInicio),
            'Hora fin': h.horaFin ? this.soloHora(h.horaFin) : '',
            'Duración (min)': this.duracionHorario(h) ?? '',
            'Terapeuta': this.terapeutaDeHorario(h),
            'Terapia': h.tipoTerapia?.nombre ?? '',
            'Notas': h.notas ?? '',
          })) },
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

  volver(): void { this.router.navigate(['/pacientes']); }
  irTratamiento(id?: number): void { if (id) this.router.navigate(['/tratamientos', id]); }
}
