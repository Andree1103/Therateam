import { Component, OnInit } from '@angular/core';
import { CitaService } from '../../../citas/Services/cita.service';
import { Cita } from '../../../citas/Models/cita.model';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { AtencionClinica } from '../../../atencion-clinica/Models/atencion.model';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../auth/Services/auth.service';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { Terapeuta, terapeutaNombre } from '../../../terapeutas/Models/terapeuta.model';
import { TipoTerapia } from '../../../citas/Models/cita.model';

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

  // ── Ordenamiento personalizado (server-side, vía Pageable de Spring) ───────
  // 'metodoPago' no es un campo de Cita sino del ultimo pago: el backend lo traduce al
  // alias del JOIN para poder ordenar en servidor (y no solo la pagina visible).
  ordenarPor: 'fechaInicio' | 'paciente.nombre' | 'terapeuta.usuario.nombre' | 'estadoPago.key' | 'precio' | 'metodoPago' = 'fechaInicio';
  direccionOrden: 'asc' | 'desc' = 'desc';

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
    private authService: AuthService,
    private terapeutaService: TerapeutaService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.catalogService.getAreas().subscribe(d => this.areas = d);
    // Solo el admin puede corregir, asi que solo para el vale la pena traer los catalogos.
    if (this.esAdmin) {
      this.terapeutaService.getAll().subscribe(t => this.terapeutas = t);
      this.citaService.getTiposTerapiaFromApi().subscribe(t => this.tiposTerapia = t);
      this.catalogService.getMetodosPago().subscribe(m => this.metodosPago = m);
    }
    this.cargar();
  }

  // ── Corrección administrativa de una atención ──────────────────────────────
  // Arreglar una carga mal hecha (terapeuta o tipo equivocado, precio mal tipeado, pago
  // registrado con otro método). Va por un endpoint aparte del PUT normal, que sigue
  // prohibiendo estos cambios en una cita atendida.

  get esAdmin(): boolean { return this.authService.esAdmin; }

  terapeutas: Terapeuta[] = [];
  tiposTerapia: TipoTerapia[] = [];
  metodosPago: CatalogItem[] = [];

  modalCorreccion = false;
  guardandoCorreccion = false;
  citaCorrigiendo: Cita | null = null;
  corrTerapeutaId: number | null = null;
  corrTipoKey = '';
  corrPrecio: number | null = null;
  corrMetodoId: number | null = null;
  corrMotivo = '';

  nombreTerapeuta = terapeutaNombre;

  abrirCorreccion(c: Cita, e: Event): void {
    e.stopPropagation();
    if (!this.esAdmin) return;
    this.citaCorrigiendo = c;
    this.corrTerapeutaId = c.terapeuta_id != null ? Number(c.terapeuta_id) : null;
    this.corrTipoKey = (c.tipo_terapia_key ?? '').toUpperCase();
    this.corrPrecio = c.precio ?? null;
    this.corrMetodoId = this.metodosPago.find(m => m.nombre === c.metodo_pago_nombre)?.id ?? null;
    this.corrMotivo = '';
    this.modalCorreccion = true;
  }

  cerrarCorreccion(): void { this.modalCorreccion = false; this.citaCorrigiendo = null; }

  /** Solo se manda lo que realmente cambio: asi el backend no registra ruido en el historial. */
  guardarCorreccion(): void {
    const c = this.citaCorrigiendo;
    if (!c?.id) return;

    const metodoActualId = this.metodosPago.find(m => m.nombre === c.metodo_pago_nombre)?.id ?? null;
    const cambios = {
      terapeutaId:    this.corrTerapeutaId !== (c.terapeuta_id != null ? Number(c.terapeuta_id) : null) ? this.corrTerapeutaId : null,
      tipoTerapiaKey: this.corrTipoKey && this.corrTipoKey !== (c.tipo_terapia_key ?? '').toUpperCase() ? this.corrTipoKey : null,
      precio:         this.corrPrecio != null && this.corrPrecio !== (c.precio ?? null) ? this.corrPrecio : null,
      metodoPagoId:   this.corrMetodoId != null && this.corrMetodoId !== metodoActualId ? this.corrMetodoId : null,
      motivo:         this.corrMotivo,
    };

    const hayCambios = cambios.terapeutaId != null || cambios.tipoTerapiaKey != null
                    || cambios.precio != null || cambios.metodoPagoId != null;
    if (!hayCambios) { this.toast.warning('No cambiaste nada'); return; }

    this.guardandoCorreccion = true;
    this.citaService.corregirAtencion(c.id, cambios).subscribe({
      next: () => {
        this.toast.success('Atención corregida');
        this.guardandoCorreccion = false;
        this.modalCorreccion = false;
        this.cargar();
      },
      error: err => {
        this.guardandoCorreccion = false;
        this.toast.error(err?.error?.error || 'No se pudo corregir la atención');
      }
    });
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
    const sort = `${this.ordenarPor},${this.direccionOrden}`;
    this.citaService.getFiltroPaged(this.paginaActual, this.tamanioPagina, this.buildFiltros(), sort).subscribe({
      next: res => {
        this.atenciones = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Error al cargar las atenciones'); }
    });
  }

  /** Clic en un encabezado de columna: si ya se estaba ordenando por esa columna invierte la
   *  dirección, si no, la elige y arranca ascendente. */
  ordenarPorColumna(campo: typeof this.ordenarPor): void {
    if (this.ordenarPor === campo) {
      this.direccionOrden = this.direccionOrden === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenarPor = campo;
      this.direccionOrden = 'asc';
    }
    this.paginaActual = 0;
    this.cargar();
  }

  iconoOrden(campo: typeof this.ordenarPor): string {
    if (this.ordenarPor !== campo) return '';
    return this.direccionOrden === 'asc' ? '▲' : '▼';
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
          'Medio de pago': c.metodo_pago_nombre ?? '',
          'Paquete': c.tratamiento_nombre ?? '',
          'Usuario creación': c.usuario_creacion_nombre ?? '',
        }));
        this.excelExportService.exportar(filas, 'atenciones');
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar las atenciones'); }
    });
  }
}
