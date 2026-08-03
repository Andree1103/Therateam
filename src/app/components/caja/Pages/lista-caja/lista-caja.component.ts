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
  resumen: CajaResumen | null = null;
  loading = false;
  cerrando = false;

  egresosForm: number | null = null;
  comentarioForm = '';

  historial: CierreCaja[] = [];
  cargandoHistorial = false;

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
  }

  private hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  cargar(): void {
    this.loading = true;
    this.cajaService.getResumen(this.fecha).subscribe({
      next: r => {
        this.resumen = r;
        this.egresosForm = r.egresos || null;
        this.comentarioForm = r.comentario || '';
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Error al cargar la caja del día'); }
    });
  }

  cargarHistorial(): void {
    this.cargandoHistorial = true;
    const hasta = this.hoyISO();
    const desdeDate = new Date();
    desdeDate.setDate(desdeDate.getDate() - 30);
    const desde = desdeDate.toISOString().slice(0, 10);
    this.cajaService.getHistorial(desde, hasta).subscribe({
      next: d => { this.historial = d; this.cargandoHistorial = false; },
      error: () => { this.cargandoHistorial = false; }
    });
  }

  onFechaChange(): void {
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
      egresos: this.egresosForm ?? 0,
      comentario: this.comentarioForm
    }).subscribe({
      next: r => {
        this.resumen = r;
        this.toast.success('Caja del día cerrada correctamente');
        this.cerrando = false;
        this.cargarHistorial();
      },
      error: () => { this.cerrando = false; this.toast.error('Error al cerrar la caja'); }
    });
  }
}
