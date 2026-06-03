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
  formPago = this.emptyPago();

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
    private toast: ToastService
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

  // ── Cálculos financieros ───────────────────────────────────────────────────

  get deuda(): number {
    if (!this.tratamiento) return 0;
    const atendidas = this.tratamiento.sesionesAtendidas ?? 0;
    const precio    = this.tratamiento.precioPorSesion  ?? 0;
    const cobrado   = this.tratamiento.totalCobrado     ?? 0;
    return Math.max(0, atendidas * precio - cobrado);
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

  abrirPago(): void { this.modalPago = true; }

  cerrarPago(): void {
    this.modalPago = false;
    this.formPago = this.emptyPago();
  }

  guardarPago(): void {
    if (!this.formPago.montoRecibido || !this.formPago.metodoId) {
      this.toast.warning('Completa monto y método de pago');
      return;
    }
    this.guardandoPago = true;
    const body = {
      tratamiento:   { id: this.tratamiento!.id },
      paciente:      { id: this.tratamiento!.pacienteId },
      metodo:        { id: this.formPago.metodoId },
      montoRecibido: this.formPago.montoRecibido,
      montoAplicado: this.formPago.montoRecibido,
      saldoGenerado: 0,
      saldoPrevio:   this.tratamiento?.saldoAFavor ?? 0,
      referencia:    this.formPago.referencia || undefined,
      notas:         this.formPago.notas      || undefined,
      fechaPago:     new Date().toISOString(),
    };
    this.pagoService.create(body as any).subscribe({
      next: () => {
        this.toast.success('Pago registrado correctamente');
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

  // ── Navegación ────────────────────────────────────────────────────────────

  volver(): void { this.router.navigate(['/tratamientos']); }

  irCitas(): void { this.router.navigate(['/citas']); }

  private emptyPago() {
    return { montoRecibido: null as number | null, metodoId: null as number | null, referencia: '', notas: '' };
  }
}
