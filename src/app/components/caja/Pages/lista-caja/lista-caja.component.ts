import { Component, OnInit } from '@angular/core';
import { CajaService } from '../../Services/caja.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CajaResumen, CierreCaja } from '../../Models/caja.model';
import { AuthService } from '../../../auth/Services/auth.service';

@Component({
  selector: 'app-lista-caja',
  templateUrl: './lista-caja.component.html',
  styleUrls: ['./lista-caja.component.css']
})
export class ListaCajaComponent implements OnInit {

  fecha: string = this.hoyISO();
  turno: 1 | 2 = 1;
  resumen: CajaResumen | null = null;
  loading = false;
  cerrando = false;

  egresosForm: number | null = null;
  comentarioForm = '';

  historial: CierreCaja[] = [];
  cargandoHistorial = false;

  // ── Hora de corte entre turno 1 y turno 2 (editable) ──────────────────────
  horaCorte = '13:00';
  editandoHoraCorte = false;
  horaCorteForm = '13:00';
  guardandoHoraCorte = false;

  constructor(
    private cajaService: CajaService,
    private toast: ToastService,
    private authService: AuthService
  ) {}

  get puedeCrear(): boolean { return this.authService.puedeCrear('CAJA'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('CAJA'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('CAJA'); }

  /** El cierre de caja crea el registro la primera vez y lo edita en cierres posteriores. */
  get puedeCerrarCaja(): boolean {
    return this.resumen?.cerrado ? this.puedeEditar : this.puedeCrear;
  }

  ngOnInit(): void {
    this.cargar();
    this.cargarHistorial();
    this.cajaService.getHoraCorte().subscribe({
      next: r => { this.horaCorte = r.horaCorte; this.horaCorteForm = r.horaCorte; },
      error: () => {}
    });
  }

  /** Fecha local (no UTC) en formato yyyy-MM-dd — toISOString() adelanta la fecha según el huso
   *  horario (en Perú, UTC-5, cerca de medianoche ya muestra el día siguiente). */
  private fechaLocalISO(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private hoyISO(): string {
    return this.fechaLocalISO(new Date());
  }

  cargar(): void {
    this.loading = true;
    this.cajaService.getResumen(this.fecha, this.turno).subscribe({
      next: r => {
        this.resumen = r;
        this.horaCorte = r.horaCorte;
        this.egresosForm = r.egresos || null;
        this.comentarioForm = r.comentario || '';
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Error al cargar la caja del turno'); }
    });
  }

  cargarHistorial(): void {
    this.cargandoHistorial = true;
    const hasta = this.hoyISO();
    const desdeDate = new Date();
    desdeDate.setDate(desdeDate.getDate() - 30);
    const desde = this.fechaLocalISO(desdeDate);
    this.cajaService.getHistorial(desde, hasta).subscribe({
      next: d => { this.historial = d; this.cargandoHistorial = false; },
      error: () => { this.cargandoHistorial = false; }
    });
  }

  onFechaChange(): void {
    this.cargar();
  }

  cambiarTurno(t: 1 | 2): void {
    if (this.turno === t) return;
    this.turno = t;
    this.cargar();
  }

  get saldoFinalPreview(): number {
    if (!this.resumen) return 0;
    const egresos = this.egresosForm ?? 0;
    return this.resumen.saldoInicial + this.resumen.totalIngresos - egresos;
  }

  cerrarCaja(): void {
    if (!this.puedeCerrarCaja) return;
    this.cerrando = true;
    this.cajaService.cerrar({
      fecha: this.fecha,
      turno: this.turno,
      egresos: this.egresosForm ?? 0,
      comentario: this.comentarioForm
    }).subscribe({
      next: r => {
        this.resumen = r;
        this.toast.success(`Caja del turno ${this.turno} cerrada correctamente`);
        this.cerrando = false;
        this.cargarHistorial();
      },
      error: () => { this.cerrando = false; this.toast.error('Error al cerrar la caja'); }
    });
  }

  // ── Hora de corte editable ────────────────────────────────────────────────
  abrirEdicionHoraCorte(): void {
    if (!this.puedeEditar) return;
    this.horaCorteForm = this.horaCorte;
    this.editandoHoraCorte = true;
  }

  cancelarEdicionHoraCorte(): void {
    this.editandoHoraCorte = false;
  }

  guardarHoraCorte(): void {
    if (!this.horaCorteForm) return;
    this.guardandoHoraCorte = true;
    this.cajaService.actualizarHoraCorte(this.horaCorteForm).subscribe({
      next: r => {
        this.horaCorte = r.horaCorte;
        this.editandoHoraCorte = false;
        this.guardandoHoraCorte = false;
        this.toast.success('Hora de corte actualizada — se aplica a partir de ahora');
        this.cargar();
      },
      error: () => { this.guardandoHoraCorte = false; this.toast.error('Error al actualizar la hora de corte'); }
    });
  }
}
