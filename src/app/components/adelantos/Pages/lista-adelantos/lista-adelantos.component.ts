import { Component, OnInit } from '@angular/core';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { Paciente, SaldoMovimiento } from '../../../pacientes/Models/paciente.model';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../auth/Services/auth.service';
import { fechaHoraAmPm } from '../../../../core/utils/formato-hora';
import { Router } from '@angular/router';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CatalogItem } from '../../../../core/models/catalog.model';

@Component({
  selector: 'app-lista-adelantos',
  templateUrl: './lista-adelantos.component.html',
  styleUrls: ['./lista-adelantos.component.css']
})
export class ListaAdelantosComponent implements OnInit {
  /** Exportar a Excel se habilita por ROL (Seguridad > Roles). */
  get puedeExportar(): boolean { return this.authService.puedeExportar(); }


  adelantos: Paciente[] = [];

  // ── Estado de cuenta del saldo (panel lateral) ────────────────────────────
  pacienteDetalle: Paciente | null = null;
  movimientos: SaldoMovimiento[] = [];
  cargandoMovimientos = false;
  loading = false;
  /** Modal para registrar un adelanto. Ver AgregarSaldoComponent. */
  modalSaldo = false;

  // ── Bajar el saldo a mano ─────────────────────────────────────────────────
  // Hasta ahora el saldo solo bajaba gastándolo: el que dejaba de venir con S/ 40 encima se los
  // quedaba para siempre. Son dos casos distintos y hay que decir cuál, porque uno mueve la caja
  // y el otro no.
  ajustando: Paciente | null = null;
  ajusteNuevoSaldo: number | null = 0;
  ajusteTipo: 'DEVOLUCION' | 'CORRECCION' = 'DEVOLUCION';
  ajusteMetodoId: number | null = null;
  ajusteMotivo = '';
  guardandoAjuste = false;
  metodosPago: CatalogItem[] = [];

  get puedeAjustar(): boolean { return this.authService.puedeEditar('PAGOS'); }

  /** Cuánto se le baja. Es lo que sale del cajón si se eligió devolución. */
  get ajusteBaja(): number {
    const actual = this.ajustando?.saldoAFavor ?? 0;
    return Math.max(0, actual - (this.ajusteNuevoSaldo ?? 0));
  }

  get ajustePuedeGuardar(): boolean {
    if (this.guardandoAjuste || !this.ajustando) return false;
    const n = this.ajusteNuevoSaldo;
    if (n == null || n < 0 || n > (this.ajustando.saldoAFavor ?? 0)) return false;
    if (this.ajusteBaja <= 0 || !this.ajusteMotivo.trim()) return false;
    // Si salió dinero hay que decir por dónde: el arqueo del turno lo necesita.
    return this.ajusteTipo !== 'DEVOLUCION' || !!this.ajusteMetodoId;
  }

  exportando = false;

  filtroPaciente = '';
  busquedaPaciente = '';

  paginaActual = 0;
  tamanioPagina = 20;
  totalElementos = 0;
  totalPaginas = 0;

  constructor(
    private pacienteService: PacienteService,
    private excelExportService: ExcelExportService,
    private toast: ToastService,
    private router: Router
  ,
    private catalogService: CatalogService,
    private authService: AuthService) {}

  ngOnInit(): void {
    this.cargar();
    this.catalogService.getMetodosPago().subscribe({
      next: m => {
        // Se ofrece por donde SALIO el dinero, asi que "Devolucion" no es una opcion: es lo que
        // ya se esta haciendo, no una forma de pago.
        this.metodosPago = m.filter(x => (x.key ?? '').toUpperCase() !== 'DEVOLUCION');
        this.ajusteMetodoId = this.metodosPago[0]?.id ?? null;
      },
      error: () => { this.metodosPago = []; }
    });
  }

  abrirAjuste(p: Paciente): void {
    if (!this.puedeAjustar) return;
    this.ajustando = p;
    this.ajusteNuevoSaldo = 0;
    this.ajusteTipo = 'DEVOLUCION';
    this.ajusteMetodoId = this.metodosPago[0]?.id ?? null;
    this.ajusteMotivo = '';
  }

  cerrarAjuste(): void { this.ajustando = null; this.guardandoAjuste = false; }

  guardarAjuste(): void {
    if (!this.ajustePuedeGuardar || !this.ajustando?.id) return;
    this.guardandoAjuste = true;
    this.pacienteService.ajustarSaldo(this.ajustando.id, {
      nuevoSaldo: this.ajusteNuevoSaldo!,
      tipo: this.ajusteTipo,
      metodoId: this.ajusteTipo === 'DEVOLUCION' ? this.ajusteMetodoId : null,
      motivo: this.ajusteMotivo.trim(),
    }).subscribe({
      next: () => {
        this.toast.success(this.ajusteTipo === 'DEVOLUCION'
          ? `Devueltos S/ ${this.ajusteBaja.toFixed(2)}. Salen del arqueo de este turno.`
          : `Saldo corregido. No se movió nada de la caja.`);
        this.cerrarAjuste();
        this.cargar();
      },
      error: err => {
        this.toast.error(err?.error?.error || 'No se pudo ajustar el saldo');
        this.guardandoAjuste = false;
      }
    });
  }

  cargar(): void {
    this.loading = true;
    this.pacienteService.getAdelantos(this.paginaActual, this.tamanioPagina, this.filtroPaciente).subscribe({
      next: res => {
        this.adelantos = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Error al cargar los adelantos'); }
    });
  }

  /** Abre el estado de cuenta: de donde salio el saldo del paciente y en que se fue gastando. */
  verEstadoDeCuenta(p: Paciente): void {
    if (!p.id) return;
    this.pacienteDetalle = p;
    this.movimientos = [];
    this.cargandoMovimientos = true;
    this.pacienteService.getSaldoMovimientos(p.id).subscribe({
      next: m => { this.movimientos = m; this.cargandoMovimientos = false; },
      error: () => {
        this.cargandoMovimientos = false;
        this.toast.error('No se pudo cargar el estado de cuenta');
      }
    });
  }

  cerrarEstadoDeCuenta(): void { this.pacienteDetalle = null; this.movimientos = []; }

  /** Total que el paciente llego a tener a favor (suma de las entradas). */
  get totalIngresado(): number {
    return this.movimientos.filter(m => m.monto > 0).reduce((a, m) => a + m.monto, 0);
  }

  /** Total ya consumido en citas o paquetes (las salidas, en positivo). */
  get totalUsado(): number {
    return this.movimientos.filter(m => m.monto < 0).reduce((a, m) => a - m.monto, 0);
  }

  /** El filtro solo se aplica al clic en "Buscar" (o Enter) — nunca mientras se tipea. */
  buscar(): void {
    this.filtroPaciente = this.busquedaPaciente.trim();
    this.paginaActual = 0;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.busquedaPaciente = '';
    this.filtroPaciente = '';
    this.paginaActual = 0;
    this.cargar();
  }

  irAPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas || p === this.paginaActual) return;
    this.paginaActual = p;
    this.cargar();
  }

  get totalSaldoAFavor(): number {
    return this.adelantos.reduce((acc, p) => acc + (p.saldoAFavor ?? 0), 0);
  }

  /** Exporta TODOS los pacientes con saldo a favor que cumplen el filtro actual (no solo la página visible). */
  exportarExcel(): void {
    this.exportando = true;
    this.pacienteService.getAdelantos(0, 10000, this.filtroPaciente).subscribe({
      next: res => {
        this.exportando = false;
        if (res.content.length === 0) { this.toast.warning('No hay adelantos para exportar con el filtro actual'); return; }
        const filas = res.content.map(p => ({
          'Paciente': `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim(),
          'DNI': p.dni ?? '',
          'Teléfono': p.telefono ?? '',
          'Correo': p.correo ?? '',
          'Motivo del saldo': p.saldoUltimoMotivo ?? '',
          'Terapeuta': p.saldoUltimoTerapeuta ?? '',
          'Fecha del movimiento': fechaHoraAmPm(p.saldoUltimaFecha),
          'Saldo a favor (S/)': p.saldoAFavor ?? '',
          'Usuario creación': p.usuarioCreacionNombre ?? '',
        }));
        this.excelExportService.exportar(filas, 'adelantos');
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar los adelantos'); }
    });
  }

  /** El paciente tenia deuda: mejor cobrarla que aparcar el dinero a favor. */
  irAPagos(): void { this.router.navigate(['/pagos']); }
}
