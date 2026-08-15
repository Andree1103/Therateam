import { Component, OnInit } from '@angular/core';
import { CitaService } from '../../../citas/Services/cita.service';
import { Cita } from '../../../citas/Models/cita.model';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { AtencionClinica } from '../../../atencion-clinica/Models/atencion.model';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-lista-atenciones',
  templateUrl: './lista-atenciones.component.html',
  styleUrls: ['./lista-atenciones.component.css']
})
export class ListaAtencionesComponent implements OnInit {

  atenciones: Cita[] = [];
  loading = false;
  exportando = false;

  areas: CatalogItem[] = [];

  // ── Búsqueda vs. filtro aplicado — igual patrón que el resto de listados: solo se
  //    aplica al hacer clic en "Buscar" (o Enter), nunca mientras se tipea/selecciona. ──
  busquedaPaciente = '';
  busquedaTerapeuta = '';
  busquedaAreaId: number | null = null;
  busquedaFechaDesde = '';
  busquedaFechaHasta = '';

  filtroPaciente = '';
  filtroTerapeuta = '';
  filtroAreaId: number | null = null;
  filtroFechaDesde = '';
  filtroFechaHasta = '';

  paginaActual = 0;
  tamanioPagina = 20;
  totalElementos = 0;
  totalPaginas = 0;

  // ── Modal de detalle de atención (solo lectura) ─────────────────────────────
  modalAbierto = false;
  cargandoDetalle = false;
  citaSeleccionada: Cita | null = null;
  atencionDetalle: AtencionClinica | null = null;

  constructor(
    private citaService: CitaService,
    private atencionService: AtencionClinicaService,
    private catalogService: CatalogService,
    private excelExportService: ExcelExportService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.catalogService.getAreas().subscribe(d => this.areas = d);
    this.cargar();
  }

  private buildFiltros() {
    return {
      estadoKey: 'ASISTIDA',
      paciente: this.filtroPaciente || undefined,
      terapeuta: this.filtroTerapeuta || undefined,
      areaId: this.filtroAreaId,
      fechaInicio: this.filtroFechaDesde ? new Date(`${this.filtroFechaDesde}T00:00:00`) : undefined,
      fechaFin: this.filtroFechaHasta ? new Date(`${this.filtroFechaHasta}T23:59:59`) : undefined,
    };
  }

  cargar(): void {
    this.loading = true;
    this.citaService.getFiltroPaged(this.paginaActual, this.tamanioPagina, this.buildFiltros()).subscribe({
      next: res => {
        this.atenciones = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Error al cargar las atenciones'); }
    });
  }

  buscar(): void {
    this.filtroPaciente = this.busquedaPaciente.trim();
    this.filtroTerapeuta = this.busquedaTerapeuta.trim();
    this.filtroAreaId = this.busquedaAreaId;
    this.filtroFechaDesde = this.busquedaFechaDesde;
    this.filtroFechaHasta = this.busquedaFechaHasta;
    this.paginaActual = 0;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.busquedaPaciente = ''; this.busquedaTerapeuta = ''; this.busquedaAreaId = null;
    this.busquedaFechaDesde = ''; this.busquedaFechaHasta = '';
    this.filtroPaciente = ''; this.filtroTerapeuta = ''; this.filtroAreaId = null;
    this.filtroFechaDesde = ''; this.filtroFechaHasta = '';
    this.paginaActual = 0;
    this.cargar();
  }

  get hayFiltrosActivos(): boolean {
    return !!(this.filtroPaciente || this.filtroTerapeuta || this.filtroAreaId || this.filtroFechaDesde || this.filtroFechaHasta);
  }

  irAPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas || p === this.paginaActual) return;
    this.paginaActual = p;
    this.cargar();
  }

  verDetalle(c: Cita): void {
    this.citaSeleccionada = c;
    this.atencionDetalle = null;
    this.modalAbierto = true;
    this.cargandoDetalle = true;
    this.atencionService.getByCita(Number(c.id)).subscribe({
      next: a => { this.atencionDetalle = a; this.cargandoDetalle = false; },
      error: () => { this.cargandoDetalle = false; }
    });
  }

  cerrarDetalle(): void {
    this.modalAbierto = false;
    this.citaSeleccionada = null;
    this.atencionDetalle = null;
  }

  /** Exporta TODAS las atenciones que cumplen el filtro actual (no solo la página visible). */
  exportarExcel(): void {
    this.exportando = true;
    this.citaService.getFiltroPaged(0, 10000, this.buildFiltros()).subscribe({
      next: res => {
        this.exportando = false;
        if (res.content.length === 0) { this.toast.warning('No hay atenciones para exportar con el filtro actual'); return; }
        const filas = res.content.map(c => ({
          'Fecha': new Date(c.fecha_inicio).toLocaleDateString('es-PE'),
          'Hora': new Date(c.fecha_inicio).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
          'Paciente': `${c.paciente_nombre ?? ''} ${c.paciente_apellido ?? ''}`.trim(),
          'DNI': c.paciente_dni ?? '',
          'Terapeuta': c.terapeuta_nombre ?? '',
          'Tipo de terapia': c.tipo_terapia_nombre ?? '',
          'Precio (S/)': c.precio ?? '',
          'Estado de pago': c.estado_pago_nombre ?? '',
          'Paquete': c.tratamiento_nombre ?? '',
        }));
        this.excelExportService.exportar(filas, 'atenciones');
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar las atenciones'); }
    });
  }
}
