import { Component, OnInit } from '@angular/core';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { Paciente } from '../../../pacientes/Models/paciente.model';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-lista-adelantos',
  templateUrl: './lista-adelantos.component.html',
  styleUrls: ['./lista-adelantos.component.css']
})
export class ListaAdelantosComponent implements OnInit {

  adelantos: Paciente[] = [];
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
          'Saldo a favor (S/)': p.saldoAFavor ?? '',
          'Usuario creación': p.usuarioCreacionNombre ?? '',
        }));
        this.excelExportService.exportar(filas, 'adelantos');
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar los adelantos'); }
    });
  }
}
