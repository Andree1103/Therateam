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
import { Paciente } from '../../Models/paciente.model';
import { Tratamiento } from '../../../tratamientos/Models/tratamiento.model';
import { Pago } from '../../../pagos/Models/pago.model';
import { Cita } from '../../../citas/Models/cita.model';
import { AtencionClinica } from '../../../atencion-clinica/Models/atencion.model';

type TabPerfilKey = 'datos' | 'tratamientos' | 'citas' | 'atenciones' | 'pagos';

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

  private pacienteId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pacienteService: PacienteService,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService,
    private citaService: CitaService,
    private atencionService: AtencionClinicaService,
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
    }).subscribe({
      next: ({ paciente, tratamientos, pagos, citas }) => {
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
