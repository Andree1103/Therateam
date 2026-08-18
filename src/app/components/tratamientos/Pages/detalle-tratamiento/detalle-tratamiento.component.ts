import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, toArray } from 'rxjs/operators';
import { TratamientoService } from '../../Services/tratamiento.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { TratamientoDetalle, Sesion, tratamientoPaciente, tratamientoTerapeuta } from '../../Models/tratamiento.model';
import { AtencionClinica } from '../../../atencion-clinica/Models/atencion.model';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { ConfiguracionService } from '../../../../core/services/configuracion.service';
import { NotaAtencionPdfService } from '../../../../core/services/nota-atencion-pdf.service';

@Component({
  selector: 'app-detalle-tratamiento',
  templateUrl: './detalle-tratamiento.component.html',
  styleUrls: ['./detalle-tratamiento.component.css']
})
export class DetalleTratamientoComponent implements OnInit {

  loading = true;
  tratamiento: TratamientoDetalle | null = null;
  sesiones: Sesion[] = [];
  metodosPago: CatalogItem[] = [];

  modalPago = false;
  guardandoPago = false;

  citasSeleccionadas = new Set<number>();
  pagoMetodoId: number | null = null;
  pagoNotas = '';
  pagoReferencia = '';

  /** "citas": eliges sesiones puntuales, cada una cobra exactamente lo que le falta.
   *  "abono": ingresas un monto libre (ej. un adelanto de S/50 que no alcanza para ninguna
   *  sesión completa) y el backend lo reparte automáticamente entre las sesiones en orden. */
  modoPago: 'citas' | 'abono' = 'citas';
  abonoMonto: number | null = null;

  atencionMap = new Map<number, AtencionClinica | null>();
  sesionExpandida: number | null = null;

  pacienteNombre = tratamientoPaciente;
  terapeutaNombre = tratamientoTerapeuta;

  private tratamientoId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService,
    private catalogService: CatalogService,
    private atencionService: AtencionClinicaService,
    private toast: ToastService,
    private configuracionService: ConfiguracionService,
    private notaAtencionPdfService: NotaAtencionPdfService
  ) {}

  ngOnInit(): void {
    this.tratamientoId = Number(this.route.snapshot.paramMap.get('id'));
    this.catalogService.getMetodosPago().subscribe(d => this.metodosPago = d);
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    forkJoin({
      tratamiento: this.tratamientoService.getDetalle(this.tratamientoId),
      sesiones: this.tratamientoService.getSesiones(this.tratamientoId).pipe(
        catchError(() => of([] as Sesion[]))
      ),
    }).subscribe({
      next: ({ tratamiento, sesiones }) => {
        this.tratamiento = tratamiento;
        this.sesiones = [...sesiones].sort((a, b) => a.numero - b.numero);
        this.loading = false;
        this.cargarAtenciones();
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error al cargar el tratamiento');
      }
    });
  }

  private cargarAtenciones(): void {
    const conCita = this.sesiones.filter(s => s.citaActiva?.id);
    if (conCita.length === 0) return;

    const requests$ = conCita.map(s =>
      this.atencionService.getByCita(s.citaActiva!.id).pipe(catchError(() => of(null)))
    );

    forkJoin(requests$).subscribe(results => {
      conCita.forEach((s, i) => {
        this.atencionMap.set(s.citaActiva!.id, results[i]);
      });
    });
  }

  toggleSesion(sesionId: number): void {
    this.sesionExpandida = this.sesionExpandida === sesionId ? null : sesionId;
  }

  getAtencion(citaId?: number): AtencionClinica | null {
    if (!citaId) return null;
    return this.atencionMap.get(citaId) ?? null;
  }

  // ── Sesiones para pagar ────────────────────────────────────────────────────

  get sesionesParaPagar(): Sesion[] {
    return this.sesiones.filter(s =>
      s.citaActiva && s.citaActiva.estadoPagoKey !== 'PAGADA'
    );
  }

  /** Cuántas sesiones del paquete todavía no tienen cita creada — se completan desde
   *  Paquetes (editar), donde está el selector de horario recurrente. */
  get sesionesFaltantes(): number {
    return Math.max(0, (this.tratamiento?.totalSesiones ?? 0) - this.sesiones.length);
  }

  /** Lo que falta por pagar de una sesión puntual — el precio completo si no tiene nada pagado
   *  todavía, o solo el resto si ya quedó PARCIAL de un pago anterior (ej. el adelanto inicial). */
  saldoPendienteSesion(s: Sesion): number {
    const precio = s.citaActiva?.precio ?? this.tratamiento?.precioPorSesion ?? 0;
    const pagado = s.citaActiva?.montoPagado ?? 0;
    return Math.max(0, precio - pagado);
  }

  get totalPago(): number {
    return this.sesiones
      .filter(s => s.citaActiva && this.citasSeleccionadas.has(s.citaActiva.id))
      .reduce((sum, s) => sum + this.saldoPendienteSesion(s), 0);
  }

  get todasSeleccionadas(): boolean {
    const para = this.sesionesParaPagar;
    return para.length > 0 && this.citasSeleccionadas.size === para.length;
  }

  toggleCitaSeleccion(citaId: number): void {
    if (this.citasSeleccionadas.has(citaId)) {
      this.citasSeleccionadas.delete(citaId);
    } else {
      this.citasSeleccionadas.add(citaId);
    }
  }

  toggleTodasCitas(): void {
    if (this.todasSeleccionadas) {
      this.citasSeleccionadas.clear();
    } else {
      this.sesionesParaPagar.forEach(s => this.citasSeleccionadas.add(s.citaActiva!.id));
    }
  }

  // ── Cálculos financieros (leídos del paquete real — mismos campos que mantiene
  //    el motor de pagos: tratamiento.totalCobrado / saldoAFavor) ─────────────

  get totalCobradoReal(): number {
    return this.tratamiento?.totalCobrado ?? 0;
  }

  get deuda(): number {
    const montoTotal = this.tratamiento?.montoTotal ?? 0;
    const cobrado = this.tratamiento?.totalCobrado ?? 0;
    return Math.max(0, montoTotal - cobrado);
  }

  get progreso(): number {
    const total     = this.tratamiento?.totalSesiones    ?? 0;
    const atendidas = this.tratamiento?.sesionesAtendidas ?? 0;
    return total > 0 ? Math.round((atendidas / total) * 100) : 0;
  }

  get estadoColor(): string {
    return this.tratamiento?.estadoColor ?? '#94a3b8';
  }

  // ── Formato de fechas ──────────────────────────────────────────────────────

  formatFecha(f?: string): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatFechaCorta(f?: string): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Modal Pago ────────────────────────────────────────────────────────────

  abrirPago(): void {
    this.citasSeleccionadas.clear();
    // Pre-seleccionar todas las citas pendientes de pago
    this.sesionesParaPagar.forEach(s => this.citasSeleccionadas.add(s.citaActiva!.id));
    this.pagoMetodoId   = this.metodosPago[0]?.id ?? null;
    this.pagoNotas      = '';
    this.pagoReferencia = '';
    this.modoPago       = 'citas';
    this.abonoMonto     = null;
    this.modalPago      = true;
  }

  cerrarPago(): void {
    this.modalPago = false;
    this.citasSeleccionadas.clear();
    this.pagoMetodoId   = null;
    this.pagoNotas      = '';
    this.pagoReferencia = '';
    this.modoPago       = 'citas';
    this.abonoMonto     = null;
  }

  guardarPago(): void {
    if (!this.pagoMetodoId) {
      this.toast.warning('Selecciona el método de pago'); return;
    }
    const pacienteId  = this.tratamiento!.pacienteId
                     ?? (this.tratamiento as any)?.paciente?.id;

    if (this.modoPago === 'abono') {
      if (!this.abonoMonto || this.abonoMonto <= 0) {
        this.toast.warning('Ingresa un monto de abono válido'); return;
      }
      this.guardandoPago = true;
      // Sin `cita`: el backend reparte este monto solo entre las sesiones del paquete, en
      // orden, completando la que ya tenía algo pagado y dejando la siguiente en PARCIAL si
      // no alcanza para una sesión entera — igual que el adelanto inicial.
      this.pagoService.create({
        tratamiento:   { id: this.tratamiento!.id },
        paciente:      pacienteId ? { id: pacienteId } : undefined,
        metodo:        { id: this.pagoMetodoId },
        montoRecibido: this.abonoMonto,
        referencia:    this.pagoReferencia || undefined,
        notas:         this.pagoNotas      || undefined,
        fechaPago:     new Date().toISOString(),
      } as any).subscribe({
        next: () => {
          this.toast.success('Abono registrado correctamente');
          this.cerrarPago();
          this.cargar();
          this.guardandoPago = false;
        },
        error: () => {
          this.toast.error('Error al registrar el abono');
          this.guardandoPago = false;
        }
      });
      return;
    }

    if (this.citasSeleccionadas.size === 0) {
      this.toast.warning('Selecciona al menos una cita para pagar'); return;
    }
    this.guardandoPago = true;
    // Cada cita cobra solo lo que le falta — si ya quedó PARCIAL de un pago anterior (ej. el
    // adelanto inicial), no se vuelve a cobrar el precio completo, solo el resto pendiente.
    const sesionesSeleccionadas = this.sesiones.filter(s => s.citaActiva && this.citasSeleccionadas.has(s.citaActiva.id));
    // Se registran UNO POR UNO (no en paralelo): cada pago recalcula el totalCobrado del paquete
    // leyendo el valor actual — si se mandan varios a la vez, dos pueden leer el mismo total antes
    // de que el anterior confirme, y uno se pisa con el otro (se pierde el aporte del primero).
    from(sesionesSeleccionadas).pipe(
      concatMap(s => this.pagoService.create({
        tratamiento:   { id: this.tratamiento!.id },
        paciente:      pacienteId ? { id: pacienteId } : undefined,
        cita:          { id: s.citaActiva!.id },
        metodo:        { id: this.pagoMetodoId },
        montoRecibido: this.saldoPendienteSesion(s),
        referencia:    this.pagoReferencia || undefined,
        notas:         this.pagoNotas      || undefined,
        fechaPago:     new Date().toISOString(),
      } as any)),
      toArray()
    ).subscribe({
      next: () => {
        const n = this.citasSeleccionadas.size;
        this.toast.success(`${n} pago${n > 1 ? 's' : ''} registrado${n > 1 ? 's' : ''} correctamente`);
        this.cerrarPago();
        this.cargar();
        this.guardandoPago = false;
      },
      error: () => {
        this.toast.error('Error al registrar el pago');
        this.guardandoPago = false;
      }
    });
  }

  // ── Cronograma (PDF para enviar por WhatsApp) ────────────────────────────

  descargarCronograma(): void {
    if (!this.tratamiento) return;
    forkJoin({
      tipos: this.catalogService.getTiposTerapia(),
      valores: this.configuracionService.getValores(),
    }).subscribe(({ tipos, valores }) => {
      const tipo = tipos.find(t => t.key === this.tratamiento!.tipoTerapiaKey);
      const areaNombre = tipo?.area?.nombre ?? this.tratamiento!.tipoTerapiaNombre ?? '';
      this.notaAtencionPdfService.descargarCronograma({
        dni: this.tratamiento!.pacienteDni ?? '',
        paciente: `${this.tratamiento!.pacienteNombre ?? ''} ${this.tratamiento!.pacienteApellido ?? ''}`.trim(),
        terapeuta: this.tratamiento!.terapeutaNombre ?? '',
        areaNombre,
        paqueteNombre: this.tratamiento!.notas || this.tratamiento!.nombre || '',
        sesiones: this.sesiones.map(s => ({
          numero: s.numero,
          fecha: s.citaActiva?.fechaInicio ? new Date(s.citaActiva.fechaInicio) : null,
          areaNombre,
          estado: s.citaActiva?.estado?.nombre ?? s.estado?.nombre ?? '',
        })),
      }, {
        nombreNegocio: valores['nombre_negocio'] || 'Thera Team',
        direccion: valores['direccion'] || '',
        telefono: valores['telefono'] || '',
      });
    });
  }

  // ── Anular paquete (todas las citas pendientes, no las ya atendidas) ──────

  mostrarAnularPaquete = false;
  anulandoPaquete = false;

  abrirAnularPaquete(): void { this.mostrarAnularPaquete = true; }
  cancelarAnularPaquete(): void { this.mostrarAnularPaquete = false; }

  confirmarAnularPaquete(devolucion: 'SALDO' | 'DINERO'): void {
    if (!this.tratamiento?.id) return;
    const msg = devolucion === 'SALDO'
      ? '¿Anular todas las citas pendientes de este paquete? Lo ya pagado por ellas quedará como saldo a favor del paciente. Las sesiones ya atendidas no se tocan.'
      : '¿Anular todas las citas pendientes y devolver el dinero? Se registra la devolución de cada sesión cancelada, sin generar saldo a favor. Las sesiones ya atendidas no se tocan.';
    if (!confirm(msg)) return;
    this.anulandoPaquete = true;
    this.tratamientoService.anularPaquete(this.tratamiento.id, devolucion).subscribe({
      next: () => {
        this.toast.success('Citas pendientes del paquete anuladas correctamente');
        this.anulandoPaquete = false;
        this.mostrarAnularPaquete = false;
        this.cargar();
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Error al anular el paquete');
        this.anulandoPaquete = false;
      }
    });
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  volver(): void { this.router.navigate(['/tratamientos']); }

  irCitas(): void { this.router.navigate(['/citas']); }

}
