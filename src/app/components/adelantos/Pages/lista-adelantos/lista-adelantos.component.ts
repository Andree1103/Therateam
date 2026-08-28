import { Component, OnInit } from '@angular/core';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { Paciente, SaldoMovimiento } from '../../../pacientes/Models/paciente.model';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-lista-adelantos',
  templateUrl: './lista-adelantos.component.html',
  styleUrls: ['./lista-adelantos.component.css']
})
export class ListaAdelantosComponent implements OnInit {

  adelantos: Paciente[] = [];

  // ── Estado de cuenta del saldo (panel lateral) ────────────────────────────
  pacienteDetalle: Paciente | null = null;
  movimientos: SaldoMovimiento[] = [];
  cargandoMovimientos = false;
  loading = false;
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
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargar();
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
          'Fecha del movimiento': p.saldoUltimaFecha ? new Date(p.saldoUltimaFecha).toLocaleDateString('es-PE') : '',
          'Saldo a favor (S/)': p.saldoAFavor ?? '',
          'Usuario creación': p.usuarioCreacionNombre ?? '',
        }));
        this.excelExportService.exportar(filas, 'adelantos');
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar los adelantos'); }
    });
  }
}
