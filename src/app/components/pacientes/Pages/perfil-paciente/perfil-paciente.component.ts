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

type TabPerfilKey = 'datos' | 'tratamientos' | 'citas' | 'atenciones' | 'pagos' | 'saldo';

@Component({
  selector: 'app-perfil-paciente',
  templateUrl: './perfil-paciente.component.html',
  styleUrls: ['./perfil-paciente.component.css']
})
export class PerfilPacienteComponent implements OnInit {

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
  ) {}

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
      },
      error: () => { this.loading = false; this.toast.error('Error al cargar el perfil'); }
    });
  }

  /** Atenciones registradas para las citas de este paciente (una cita atendida se convierte en atención). */
  private cargarAtenciones(): void {
    const citasConId = this.citas.filter(c => c.id);
    if (citasConId.length === 0) { this.atenciones = []; return; }
    forkJoin(citasConId.map(c => this.atencionService.getByCita(Number(c.id)).pipe(catchError(() => of(null)))))
      .subscribe(resultados => {
        this.atenciones = resultados.filter((a): a is AtencionClinica => a != null);
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
