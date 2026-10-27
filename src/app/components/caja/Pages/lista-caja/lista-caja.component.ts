import { Component, OnInit } from '@angular/core';
import { CajaService } from '../../Services/caja.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CajaResumen } from '../../Models/caja.model';
import { AuthService } from '../../../auth/Services/auth.service';
import { ExcelExportService } from '../../../../core/services/excel-export.service';

@Component({
  selector: 'app-lista-caja',
  templateUrl: './lista-caja.component.html',
  styleUrls: ['./lista-caja.component.css']
})
export class ListaCajaComponent implements OnInit {
  /** Exportar a Excel se habilita por ROL (Seguridad > Roles). */
  get puedeExportar(): boolean { return this.authService.puedeExportar(); }

  /**
   * Si este usuario ve el acumulado del negocio.
   *
   * Cubre el saldo inicial Y el final, no solo el inicial: el final es inicial + ingresos -
   * egresos, asi que enseñando uno se despeja el otro con una resta. Quien no lo tenga ve lo
   * de su turno —ingresos, egresos y el neto— que es lo que necesita para cuadrar el cajon.
   */
  get puedeVerSaldoInicial(): boolean { return this.authService.puedeVerSaldoInicial(); }

  /**
   * Permiso propio, no el "editar" del modulo.
   *
   * Cambiar la hora de corte no es operar la caja del dia: es mover la linea que la parte en
   * dos, y eso recalcula que entro en cada turno — incluidos los ya cerrados. Quien registra
   * egresos o reabre un turno no tiene por que poder hacerlo.
   */
  get puedeEditarHoraCorte(): boolean { return this.authService.puedeEditarHoraCorte(); }

  /** Lo que entro menos lo que salio en este turno, sin arrastrar nada de dias anteriores. */
  get netoDelTurno(): number {
    if (!this.resumen) return 0;
    return this.resumen.totalIngresos - (this.resumen.egresos ?? 0);
  }


  fecha: string = this.hoyISO();
  turno: 1 | 2 = 1;
  resumen: CajaResumen | null = null;
  loading = false;
  cerrando = false;

  egresosForm: number | null = null;
  comentarioForm = '';

  /**
   * El historial lista TURNOS CON MOVIMIENTO, no cierres.
   *
   * Antes salia de /caja/historial, que devuelve los cierres guardados. Si nadie cierra, la
   * tabla aparece vacia y el boton de exportar deshabilitado — con el dinero cobrado y todo.
   * Esa es la version suave; la dura es peor: cuando se cierra la manana y nunca la tarde, el
   * historial enseña media verdad y parece completo. Pasandolo a resumen-rango, un turno que
   * movio plata y no se cerro aparece igual, marcado, y el agujero se ve.
   */
  historial: CajaResumen[] = [];
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
    this.cajaService.getResumenRango(desde, hasta).subscribe({
      next: d => {
        // El servidor los manda de mas viejo a mas nuevo; aqui interesa al reves, porque lo que
        // se consulta es "que paso estos dias", empezando por ayer.
        this.historial = [...d].sort((a, b) =>
          b.fecha.localeCompare(a.fecha) || b.turno - a.turno);
        this.cargandoHistorial = false;
      },
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
  // ── Exportar un rango de dias ────────────────────────────────────────────
  // Antes solo salia el dia y turno que estabas mirando. Para cuadrar un mes habia que exportar
  // sesenta veces y pegar las hojas a mano.

  mostrarRangoExport = false;
  exportDesde = '';
  exportHasta = '';

  abrirRangoExport(): void {
    // Arranca en el dia que se esta viendo: lo mas comun sigue siendo exportar hoy, y asi eso
    // son dos clics y no teclear dos fechas.
    this.exportDesde = this.exportDesde || this.fecha;
    this.exportHasta = this.exportHasta || this.fecha;
    this.mostrarRangoExport = true;
  }

  cerrarRangoExport(): void { this.mostrarRangoExport = false; }

  exportarExcel(): void {
    if (!this.exportDesde || !this.exportHasta) {
      this.toast.warning('Indica la fecha de inicio y la de fin'); return;
    }
    if (this.exportHasta < this.exportDesde) {
      this.toast.warning('La fecha de fin no puede ser anterior a la de inicio'); return;
    }
    this.exportando = true;
    this.cajaService.getResumenRango(this.exportDesde, this.exportHasta).subscribe({
      next: resumenes => {
        const filas = resumenes.flatMap(r => this.filasDe(r));
        if (filas.length === 0) {
          this.toast.warning('No hay ingresos registrados en ese rango');
          this.exportando = false;
          return;
        }
        const nombre = this.exportDesde === this.exportHasta
          ? `caja_${this.exportDesde}`
          : `caja_${this.exportDesde}_a_${this.exportHasta}`;
        this.excelExportService.exportar(filas, nombre);
        this.exportando = false;
        this.mostrarRangoExport = false;
      },
      error: err => {
        this.toast.error(err?.error?.error || 'No se pudo exportar el rango');
        this.exportando = false;
      }
    });
  }

  /**
   * Las filas de un dia/turno. Tres bloques en la misma hoja, distinguidos por la columna Tipo:
   * el mismo total visto por concepto, por metodo, y el detalle de que productos salieron.
   */
  private filasDe(r: CajaResumen): any[] {
    const fechaStr = new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-PE');
    const fila = (tipo: string, detalle: string, monto: number, unidades: number | '' = '') => ({
      'Fecha': fechaStr,
      'Turno': r.turno,
      'Tipo': tipo,
      'Detalle': detalle,
      'Unidades': unidades,
      'Monto (S/)': monto,
    });
    return [
      ...(r.ingresosPorConcepto ?? []).map(c => fila('Concepto', c.nombre, c.monto)),
      ...(r.ingresosPorMetodo ?? []).map(m => fila('Método de pago', m.metodoNombre, m.monto)),
      ...(r.ventasPorProducto ?? []).map(v => fila('Producto vendido', v.nombreProducto, v.total, v.unidades)),
      fila('TOTAL', 'Ingresos del turno', r.totalIngresos),
    ];
  }

  /** Turnos del rango que movieron plata y nadie cerro. Es el numero que delata el agujero. */
  get turnosSinCerrar(): number {
    return this.historial.filter(h => !h.cerrado).length;
  }

  get turnosCerrados(): number {
    return this.historial.filter(h => h.cerrado).length;
  }

  /**
   * El saldo acumulado solo tiene sentido en un turno CERRADO.
   *
   * El saldo inicial sale del ultimo cierre anterior; si no se cerro, ese cierre puede ser de
   * hace una semana y el "saldo final" que resulta no es un acumulado sino lo que entro ese
   * turno, sumado a un arrastre viejo. Mostrarlo como saldo seria dar por cuadrado algo que
   * nadie cuadro, asi que en esas filas va una raya.
   */
  tieneAcumulado(h: CajaResumen): boolean { return h.cerrado; }

  /** Exporta lo mismo que se ve: los turnos con movimiento de los ultimos 30 dias. */
  exportarHistorial(): void {
    if (this.historial.length === 0) return;
    this.exportando = true;
    const raya = '—';
    const filas = this.historial.map(h => ({
      'Fecha': new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-PE'),
      'Turno': h.turno,
      'Cierre': h.cerrado ? 'Cerrado' : 'SIN CERRAR',
      'Cerrado por': h.cerradoPorNombre ?? '',
      // El acumulado solo va para quien puede verlo en pantalla. Si no, el Excel seria la
      // puerta de atras del permiso.
      ...(this.puedeVerSaldoInicial
            ? { 'Saldo inicial (S/)': h.cerrado ? h.saldoInicial : raya }
            : {}),
      'Ingresos (S/)': h.totalIngresos,
      'Egresos (S/)': h.cerrado ? h.egresos : raya,
      ...(this.puedeVerSaldoInicial
            ? { 'Saldo final (S/)': h.cerrado ? h.saldoFinal : raya }
            : { 'Neto del turno (S/)': h.cerrado ? h.totalIngresos - (h.egresos ?? 0) : raya }),
      'Comentario': h.comentario ?? '',
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
