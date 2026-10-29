import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CitaService } from '../../../citas/Services/cita.service';
import { TratamientoService } from '../../../tratamientos/Services/tratamiento.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { Cita } from '../../../citas/Models/cita.model';
import { Tratamiento } from '../../../tratamientos/Models/tratamiento.model';
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
  tratamientos: Tratamiento[] = [];

  /**
   * Cada cifra se pide ya acotada, en vez de bajarse la tabla entera y recortarla aqui.
   *
   * Antes esta pantalla pedia "las primeras mil citas" y "los primeros mil pagos" y calculaba
   * todo en el navegador. Mil parecia de sobra hasta que dejo de serlo: con 1.809 citas, esas
   * mil eran las mas VIEJAS —del 1 al 26 de octubre—, asi que las de hoy y las proximas no
   * entraban y los dos paneles salian vacios con la agenda llena. Los ingresos del mes y la
   * tasa de asistencia salian del mismo trozo, o sea que tambien estaban mal, solo que sin
   * dar la cara.
   */
  citasDeHoy: Cita[] = [];
  citasDeLaSemana: Cita[] = [];
  ingresosDelMes = 0;
  pagosDelMes = 0;
  tasaAsistencia = 0;

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
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
    const hoy24 = new Date(hoy0); hoy24.setDate(hoy24.getDate() + 1);
    const enUnaSemana = new Date(hoy0); enUnaSemana.setDate(enUnaSemana.getDate() + 7);
    const primeroDelMes = new Date(hoy0.getFullYear(), hoy0.getMonth(), 1);
    const ahora = new Date();

    forkJoin({
      citasHoy:     this.citaService.getCitas({ fechaInicio: hoy0, fechaFin: hoy24 })
                        .pipe(catchError(() => of([] as Cita[]))),
      citasSemana:  this.citaService.getCitas({ fechaInicio: hoy0, fechaFin: enUnaSemana })
                        .pipe(catchError(() => of([] as Cita[]))),
      pagosDelMes:  this.pagoService.resumenEntreFechas(primeroDelMes, ahora)
                        .pipe(catchError(() => of({ total: 0, cantidad: 0 }))),
      asistencia:   this.asistenciaHistorica(),
      tratamientos: this.tratamientoService.getAll().pipe(catchError(() => of([] as Tratamiento[]))),
      caja:         this.cajaDelUltimoMes(),
    }).subscribe({
      next: ({ citasHoy, citasSemana, pagosDelMes, asistencia, tratamientos, caja }) => {
        this.citasDeHoy      = citasHoy;
        this.citasDeLaSemana = citasSemana;
        this.ingresosDelMes  = pagosDelMes.total ?? 0;
        this.pagosDelMes     = pagosDelMes.cantidad ?? 0;
        this.tasaAsistencia  = asistencia;
        this.tratamientos    = tratamientos;
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

  get citasHoy(): Cita[] { return this.citasDeHoy; }

  get citasSemana(): Cita[] { return this.citasDeLaSemana; }

  /**
   * La tasa historica, contada donde estan los datos.
   *
   * Son cinco peticiones de una fila cada una: solo interesa el total de la pagina. Sale mas
   * barato que traerse las citas y mucho mas barato que equivocarse, que es lo que pasaba
   * cuando se calculaba sobre el trozo que cupiera en mil filas.
   */
  private asistenciaHistorica() {
    const CUENTAN = ['ASISTIDA', 'NO_ASISTIO', 'ANULADA', 'CANCELADA_PACIENTE', 'CANCELADA_CLINICA'];
    return forkJoin(CUENTAN.map(k => this.citaService.contarPorEstado(k))).pipe(
      map(totales => {
        const relevantes = totales.reduce((a, b) => a + b, 0);
        return relevantes > 0 ? Math.round((totales[0] / relevantes) * 100) : 0;
      }),
      catchError(() => of(0))
    );
  }

  get tratamientosActivos(): Tratamiento[] {
    return this.tratamientos.filter(t => t.estadoKey === 'ACTIVO');
  }

  get deudaTotal(): number {
    return this.tratamientos.reduce((acc, t) => {
      return acc + Math.max(0, (t.sesionesAtendidas ?? 0) * (t.precioPorSesion ?? 0) - (t.totalCobrado ?? 0));
    }, 0);
  }

  get ingresosMes(): number { return this.ingresosDelMes; }

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
    return this.citasDeLaSemana
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
