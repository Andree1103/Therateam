import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CitaService } from '../../../citas/Services/cita.service';
import { TratamientoService } from '../../../tratamientos/Services/tratamiento.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { Cita } from '../../../citas/Models/cita.model';
import { Tratamiento } from '../../../tratamientos/Models/tratamiento.model';
import { Pago } from '../../../pagos/Models/pago.model';
import { CajaService } from '../../../caja/Services/caja.service';
import { CajaResumen } from '../../../caja/Models/caja.model';
import { AuthService } from '../../../auth/Services/auth.service';

interface EstadoResumen { key: string; nombre: string; color: string; count: number; }

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  loading = true;
  citas: Cita[] = [];
  tratamientos: Tratamiento[] = [];
  pagos: Pago[] = [];

  /**
   * Turnos de caja con dinero que ya terminaron y nadie cerro.
   *
   * No es una regla nueva, es un recordatorio: se les pasa cerrar el turno de la tarde y el
   * historial de Caja solo lo dice si uno entra a mirarlo. Aqui lo ven al abrir el sistema.
   *
   * Se calcula una sola vez al cargar, no en un getter: parsear fechas en cada ciclo de
   * deteccion de cambios no aporta nada, el dato no se mueve mientras la pantalla esta abierta.
   */
  turnosSinCerrar: CajaResumen[] = [];

  constructor(
    private citaService: CitaService,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService,
    private cajaService: CajaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    forkJoin({
      citas:        this.citaService.getCitas().pipe(catchError(() => of([] as Cita[]))),
      tratamientos: this.tratamientoService.getAll().pipe(catchError(() => of([] as Tratamiento[]))),
      pagos:        this.pagoService.getAll().pipe(catchError(() => of([] as Pago[]))),
      caja:         this.cajaDelUltimoMes(),
    }).subscribe({
      next: ({ citas, tratamientos, pagos, caja }) => {
        this.citas        = citas;
        this.tratamientos = tratamientos;
        this.pagos        = pagos;
        // Del mas viejo al mas nuevo: el olvidado hace una semana es el que urge, no el de ayer.
        this.turnosSinCerrar = caja
          .filter(h => !h.cerrado && this.yaTermino(h))
          .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.turno - b.turno);
        this.loading      = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // -- Caja sin cerrar -------------------------------------------------------

  /** Quien no ve Caja no puede cerrarla: a ese no se le avisa (y no se le pide el dato). */
  private cajaDelUltimoMes() {
    if (!this.authService.tieneModulo('CAJA')) return of([] as CajaResumen[]);
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    return this.cajaService.getResumenRango(this.fechaISO(desde), this.fechaISO(new Date()))
      .pipe(catchError(() => of([] as CajaResumen[])));
  }

  /** Fecha local, no UTC: toISOString() en Peru (UTC-5) ya adelanta el dia por la tarde. */
  private fechaISO(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /**
   * Un turno recien empezado no esta "sin cerrar", esta en curso: se cierra al final.
   * El turno 1 termina a la hora de corte; el turno 2, a la medianoche.
   */
  private yaTermino(h: CajaResumen): boolean {
    const [a, m, d] = h.fecha.split('-').map(Number);
    const fin = new Date(a, m - 1, d);
    if (h.turno === 1) {
      // Number('') es 0, no NaN: sin este chequeo una hora de corte vacia daria medianoche y el
      // aviso saltaria por el turno de la mañana desde las 00:01, con el turno todavia por delante.
      const [hh, mm] = (h.horaCorte || '').split(':').map(Number);
      const legible = hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
      fin.setHours(legible ? hh : 14, legible ? mm : 0, 0, 0);
    } else {
      fin.setDate(fin.getDate() + 1);
    }
    return fin.getTime() <= Date.now();
  }

  etiquetaTurno(h: CajaResumen): string {
    const [a, m, d] = h.fecha.split('-').map(Number);
    const fecha = new Date(a, m - 1, d)
      .toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
    return `${fecha} - ${h.turno === 1 ? 'Mañana' : 'Tarde'}`;
  }

  /** Lo que esta en juego, para que el aviso no se lea como un tramite. */
  get dineroSinCerrar(): number {
    return this.turnosSinCerrar.reduce((s, h) => s + (h.totalIngresos ?? 0), 0);
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────

  get citasHoy(): Cita[] {
    const hoy = new Date();
    return this.citas.filter(c => {
      const f = new Date(c.fecha_inicio);
      return f.getFullYear() === hoy.getFullYear() &&
             f.getMonth()    === hoy.getMonth()    &&
             f.getDate()     === hoy.getDate();
    });
  }

  get citasSemana(): Cita[] {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const fin = new Date(hoy); fin.setDate(fin.getDate() + 7);
    return this.citas.filter(c => {
      const f = new Date(c.fecha_inicio);
      return f >= hoy && f < fin;
    });
  }

  get tratamientosActivos(): Tratamiento[] {
    return this.tratamientos.filter(t => t.estadoKey === 'ACTIVO');
  }

  get deudaTotal(): number {
    return this.tratamientos.reduce((acc, t) => {
      return acc + Math.max(0, (t.sesionesAtendidas ?? 0) * (t.precioPorSesion ?? 0) - (t.totalCobrado ?? 0));
    }, 0);
  }

  get ingresosMes(): number {
    const hoy = new Date();
    return this.pagos
      .filter(p => {
        const f = new Date(p.fechaPago ?? '');
        return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
      })
      .reduce((s, p) => s + (p.montoRecibido ?? 0), 0);
  }

  get tasaAsistencia(): number {
    const asistidas = this.citas.filter(c => c.estado === 'ASISTIDA').length;
    const relevantes = this.citas.filter(c =>
      ['ASISTIDA','NO_ASISTIO','ANULADA','CANCELADA_PACIENTE','CANCELADA_CLINICA'].includes(c.estado)
    ).length;
    return relevantes > 0 ? Math.round((asistidas / relevantes) * 100) : 0;
  }

  get resumenEstados(): EstadoResumen[] {
    const map: Record<string, { nombre: string; color: string; count: number }> = {};
    for (const c of this.citasHoy) {
      if (!map[c.estado]) map[c.estado] = { nombre: c.estado, color: '#94a3b8', count: 0 };
      map[c.estado].count++;
    }
    return Object.entries(map).map(([key, v]) => ({ key, ...v }));
  }

  get proximasCitas(): Cita[] {
    const ahora = new Date();
    return this.citas
      .filter(c => new Date(c.fecha_inicio) >= ahora &&
        !['ANULADA','CANCELADA_PACIENTE','CANCELADA_CLINICA','NO_ASISTIO'].includes(c.estado))
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
      .slice(0, 8);
  }

  formatHora(f: Date): string {
    return new Date(f).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  formatFecha(f: Date): string {
    return new Date(f).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}
