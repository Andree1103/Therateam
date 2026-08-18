import { Component, OnInit } from '@angular/core';
import { CajaService } from '../../Services/caja.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CajaResumen, CierreCaja } from '../../Models/caja.model';
import { AuthService } from '../../../auth/Services/auth.service';
import { ExcelExportService } from '../../../../core/services/excel-export.service';

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

  exportando = false;

  constructor(
    private cajaService: CajaService,
    private toast: ToastService,
    private authService: AuthService,
    private excelExportService: ExcelExportService
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

  /**
   * Exporta el día/turno que se está viendo (ingresos por método + totales) — antes el único
   * botón exportaba el historial de cierres y quedaba deshabilitado si todavía no se había
   * cerrado ningún turno en los últimos 30 días, aunque el día seleccionado sí tuviera ingresos.
   */
  exportarExcel(): void {
    if (!this.resumen) return;
    if (this.resumen.ingresosPorMetodo.length === 0) {
      this.toast.warning('No hay ingresos registrados para exportar en este turno'); return;
    }
    this.exportando = true;
    const fechaStr = new Date(this.resumen.fecha + 'T00:00:00').toLocaleDateString('es-PE');
    const filas = this.resumen.ingresosPorMetodo.map(m => ({
      'Fecha': fechaStr,
      'Turno': this.resumen!.turno,
      'Método': m.metodoNombre,
      'Monto (S/)': m.monto,
    }));
    filas.push({
      'Fecha': fechaStr,
      'Turno': this.resumen.turno,
      'Método': 'TOTAL',
      'Monto (S/)': this.resumen.totalIngresos,
    });
    this.excelExportService.exportar(filas, `caja_${this.fecha}_turno${this.turno}`);
    this.exportando = false;
  }

  /** Exporta el historial de cierres visible (últimos 30 días) — mismo rango que se ve en pantalla. */
  exportarHistorial(): void {
    if (this.historial.length === 0) return;
    this.exportando = true;
    const filas = this.historial.map(h => ({
      'Fecha': new Date(h.fecha).toLocaleDateString('es-PE'),
      'Turno': h.turno,
      'Saldo inicial (S/)': h.saldoInicial,
      'Ingresos (S/)': h.totalIngresos,
      'Egresos (S/)': h.egresos,
      'Saldo final (S/)': h.saldoFinal,
      'Comentario': h.comentario ?? '',
      'Usuario creación': h.cerradoPor ? `${h.cerradoPor.nombre ?? ''} ${h.cerradoPor.apellido ?? ''}`.trim() : '',
    }));
    this.excelExportService.exportar(filas, 'caja_historial');
    this.exportando = false;
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
