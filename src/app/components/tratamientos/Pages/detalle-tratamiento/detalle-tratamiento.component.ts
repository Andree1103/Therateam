import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

  get totalPago(): number {
    return this.citasSeleccionadas.size * (this.tratamiento?.precioPorSesion ?? 0);
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
    this.modalPago      = true;
  }

  cerrarPago(): void {
    this.modalPago = false;
    this.citasSeleccionadas.clear();
    this.pagoMetodoId   = null;
    this.pagoNotas      = '';
    this.pagoReferencia = '';
  }

  guardarPago(): void {
    if (this.citasSeleccionadas.size === 0) {
      this.toast.warning('Selecciona al menos una cita para pagar'); return;
    }
    if (!this.pagoMetodoId) {
      this.toast.warning('Selecciona el método de pago'); return;
    }
    this.guardandoPago = true;
    const precio      = this.tratamiento!.precioPorSesion ?? 0;
    const saldoPrevio = this.tratamiento?.saldoAFavor     ?? 0;
    const pacienteId  = this.tratamiento!.pacienteId
                     ?? (this.tratamiento as any)?.paciente?.id;
    const pagos$      = Array.from(this.citasSeleccionadas).map(citaId =>
      this.pagoService.create({
        tratamiento:   { id: this.tratamiento!.id },
        paciente:      pacienteId ? { id: pacienteId } : undefined,
        cita:          { id: citaId },
        metodo:        { id: this.pagoMetodoId },
        montoRecibido: precio,
        montoAplicado: precio,
        saldoGenerado: 0,
        saldoPrevio,
        referencia:    this.pagoReferencia || undefined,
        notas:         this.pagoNotas      || undefined,
        fechaPago:     new Date().toISOString(),
      } as any)
    );
    forkJoin(pagos$).subscribe({
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
        })),
      }, {
        nombreNegocio: valores['nombre_negocio'] || 'Thera Team',
        direccion: valores['direccion'] || '',
        telefono: valores['telefono'] || '',
      });
    });
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  volver(): void { this.router.navigate(['/tratamientos']); }

  irCitas(): void { this.router.navigate(['/citas']); }

}
