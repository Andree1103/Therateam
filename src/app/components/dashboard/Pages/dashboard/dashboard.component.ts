import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CitaService } from '../../../citas/Services/cita.service';
import { TratamientoService } from '../../../tratamientos/Services/tratamiento.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { Cita } from '../../../citas/Models/cita.model';
import { Tratamiento } from '../../../tratamientos/Models/tratamiento.model';
import { Pago } from '../../../pagos/Models/pago.model';

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

  constructor(
    private citaService: CitaService,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService
  ) {}

  ngOnInit(): void {
    forkJoin({
      citas:        this.citaService.getCitas().pipe(catchError(() => of([] as Cita[]))),
      tratamientos: this.tratamientoService.getAll().pipe(catchError(() => of([] as Tratamiento[]))),
      pagos:        this.pagoService.getAll().pipe(catchError(() => of([] as Pago[]))),
    }).subscribe({
      next: ({ citas, tratamientos, pagos }) => {
        this.citas        = citas;
        this.tratamientos = tratamientos;
        this.pagos        = pagos;
        this.loading      = false;
      },
      error: () => { this.loading = false; }
    });
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
    return this.tratamientos.filter(t => t.estadoTratamiento?.key === 'ACTIVO');
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
      ['ASISTIDA','NO_ASISTIO','CANCELADA_PACIENTE','CANCELADA_CLINICA'].includes(c.estado)
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
        !['CANCELADA_PACIENTE','CANCELADA_CLINICA','NO_ASISTIO'].includes(c.estado))
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
