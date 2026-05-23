import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CitaService } from '../../Services/cita.service';
import { Cita } from '../../Models/cita.model';

export interface DiaSemana { nombre: string; fecha: Date; }
export interface Slot { h: number; m: number; lbl: string; }

export const TIPO_CITA = {
  conv: { n: 'Convencional', dur: 45, maxPac: 2 },
  pers: { n: 'Personalizado', dur: 40, maxPac: 1 },
  kids: { n: 'Kids',          dur: 40, maxPac: 1 },
} as const;

export type TipoCita = keyof typeof TIPO_CITA;
export type EstadoCita = 'azul' | 'verde' | 'rojo';

@Component({
  selector: 'app-lista-citas',
  templateUrl: './lista-citas.component.html',
  styleUrls: ['./lista-citas.component.css']
})
export class ListaCitasComponent implements OnInit {

  // ── datos ──────────────────────────────────────────────────────────────────
  citas: Cita[] = [];
  loading = true;

  // ── filtros ────────────────────────────────────────────────────────────────
  filtroTerapeuta = '';

  // ── vista ──────────────────────────────────────────────────────────────────
  vista: 'semana' | 'libre' = 'semana';

  // ── semana ─────────────────────────────────────────────────────────────────
  fechaInicioSemana!: Date;
  diasSemana: DiaSemana[] = [];
  weekLabel = '';

  // ── slots: 08:00 → 19:40, cada 40 min ─────────────────────────────────────
  slots: Slot[] = [];

  // ── modal ──────────────────────────────────────────────────────────────────
  modalAbierto = false;
  modoFormulario: 'regular' | 'kids' = 'regular';
  citaEditando: Cita | null = null;
  preSlot: { dia: number; h: number; m: number } | null = null;

  // form fields
  fPac = ''; fTer = ''; fTipo: TipoCita = 'conv';
  fDia = 0; fH = 8; fM = 0; fDur = 45; fEst: EstadoCita = 'azul';

  readonly TIPOS = Object.entries(TIPO_CITA).map(([id, v]) => ({ id, ...v }));
  readonly ESTADOS: { v: EstadoCita; lbl: string }[] = [
    { v: 'azul',  lbl: 'Agendado'   },
    { v: 'verde', lbl: 'Asistió'    },
    { v: 'rojo',  lbl: 'No asistió' },
  ];
  readonly DIAS_NOM = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  get terapeutas(): string[] {
    return [...new Set(this.citas.map(c => c.terapeuta_nombre || ''))].filter(n => n);
  }

  constructor(private citaService: CitaService, private router: Router) {}

  ngOnInit(): void {
    this.generarSlots();
    this.irHoy();
  }

  // ── slots ──────────────────────────────────────────────────────────────────
  generarSlots(): void {
    this.slots = [];
    for (let h = 8; h < 20; h++) {
      for (const m of [0, 40]) {
        const hh = String(h).padStart(2, '0');
        const mm = m === 0 ? '00' : '40';
        this.slots.push({ h, m, lbl: `${hh}:${mm}` });
      }
    }
  }

  // ── semana ─────────────────────────────────────────────────────────────────
  irHoy(): void {
    const hoy = new Date();
    const dow = hoy.getDay();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + (dow === 0 ? -6 : 1 - dow));
    lunes.setHours(0, 0, 0, 0);
    this.fechaInicioSemana = lunes;
    this.construirSemana();
    this.cargarCitas();
  }

  navSemana(dir: -1 | 1): void {
    const d = new Date(this.fechaInicioSemana);
    d.setDate(d.getDate() + dir * 7);
    this.fechaInicioSemana = d;
    this.construirSemana();
    this.cargarCitas();
  }

  construirSemana(): void {
    this.diasSemana = this.DIAS_NOM.map((nombre, i) => {
      const fecha = new Date(this.fechaInicioSemana);
      fecha.setDate(this.fechaInicioSemana.getDate() + i);
      return { nombre, fecha };
    });
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    const ini = this.fechaInicioSemana.toLocaleDateString('es-PE', opts);
    const fin = this.diasSemana[6].fecha.toLocaleDateString('es-PE', opts);
    this.weekLabel = `${ini} – ${fin}`;
  }

  // ── datos ──────────────────────────────────────────────────────────────────
  cargarCitas(): void {
    this.loading = true;
    this.citaService.getCitas().subscribe({
      next: citas => { this.citas = citas; this.loading = false; },
      error: err  => { console.error(err); this.loading = false; }
    });
  }

  // ── lookup ─────────────────────────────────────────────────────────────────
  /**
   * Devuelve las citas para un slot (día-índice, hora, minuto).
   * dia es el índice 0-6 de diasSemana.
   */
  getCitasSlot(diaIdx: number, h: number, m: number): Cita[] {
    const fecha = this.diasSemana[diaIdx]?.fecha;
    if (!fecha) return [];
    return this.citas.filter(c => {
      const ini = new Date(c.fecha_inicio);
      const mismaFecha =
        ini.getFullYear() === fecha.getFullYear() &&
        ini.getMonth()    === fecha.getMonth()    &&
        ini.getDate()     === fecha.getDate()     &&
        ini.getHours()    === h                   &&
        ini.getMinutes()  === m;
      const terOk = !this.filtroTerapeuta || c.terapeuta_nombre === this.filtroTerapeuta;
      return mismaFecha && terOk;
    });
  }

  /** Slots libres de un terapeuta en toda la semana */
  getLibresTerapeuta(terapeuta: string): number {
    let libre = 0;
    for (let di = 0; di < 7; di++) {
      for (const s of this.slots) {
        const citasAqui = this.getCitasSlot(di, s.h, s.m)
          .filter(c => c.terapeuta_nombre === terapeuta);
        if (citasAqui.length === 0) {
          libre++;
        } else if (citasAqui[0].tipo_terapia_nombre === 'conv' && citasAqui.length < 2) {
          libre++;
        }
      }
    }
    return libre;
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  esHoy(fecha: Date): boolean {
    const h = new Date();
    return fecha.getDate() === h.getDate() &&
           fecha.getMonth() === h.getMonth() &&
           fecha.getFullYear() === h.getFullYear();
  }

  getEstadoClass(cita: Cita): 'azul' | 'verde' | 'rojo' {
    if (cita.estado === 'ASISTIDA') return 'verde';
    if (cita.estado === 'NO_ASISTIO') return 'rojo';
    return 'azul';
  }

  getDuracionFija(tipo: TipoCita): number {
    return TIPO_CITA[tipo].dur;
  }

  getMaxPac(tipo: TipoCita): number {
    return TIPO_CITA[tipo].maxPac;
  }

  getDurInfo(): string {
    if (this.fTipo === 'pers' || this.fTipo === 'kids') {
      return 'Duración fija: 40 min · 1 paciente por slot';
    }
    return `Convencional: hasta 2 pacientes simultáneos · ${this.fDur} min`;
  }

  // ── modal ──────────────────────────────────────────────────────────────────
  abrirNueva(): void {
    this.citaEditando = null;
    this.preSlot = null;
    this.resetForm();
    this.modalAbierto = true;
  }

  abrirSlot(diaIdx: number, s: Slot): void {
    this.citaEditando = null;
    this.preSlot = { dia: diaIdx, h: s.h, m: s.m };
    this.resetForm();
    this.fDia = diaIdx;
    this.fH = s.h;
    this.fM = s.m;
    this.modalAbierto = true;
  }

  abrirEditar(cita: Cita, e: Event): void {
    e.stopPropagation();
    this.citaEditando = cita;
    const ini = new Date(cita.fecha_inicio);
    this.fPac  = `${cita.paciente_nombre} ${cita.paciente_apellido}`;
    this.fTer  = cita.terapeuta_nombre || '';
    this.fTipo = (cita.tipo_terapia_nombre as TipoCita) || 'conv';
    this.fDia  = this.diasSemana.findIndex(d =>
      d.fecha.getDate() === ini.getDate() && d.fecha.getMonth() === ini.getMonth());
    this.fH    = ini.getHours();
    this.fM    = ini.getMinutes();
    this.fDur  = cita.duracion_minutos;
    this.fEst  = this.getEstadoClass(cita);
    this.modoFormulario = this.fTipo === 'kids' ? 'kids' : 'regular';
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; this.citaEditando = null; }

  resetForm(): void {
    this.fPac = ''; this.fTer = this.terapeutas[0] || '';
    this.fTipo = 'conv'; this.fDia = 0; this.fH = 8; this.fM = 0;
    this.fDur = 45; this.fEst = 'azul';
    this.modoFormulario = 'regular';
  }

  cambiarModo(m: 'regular' | 'kids'): void {
    this.modoFormulario = m;
    this.fTipo = m === 'kids' ? 'kids' : 'conv';
    if (m === 'kids') this.fDur = 40;
  }

  onTipoChange(): void {
    if (this.fTipo !== 'conv') this.fDur = 40;
    else if (this.fDur < 45) this.fDur = 45;
  }

  guardarCita(): void {
    // validación de capacidad
    const citasEnSlot = this.getCitasSlot(this.fDia, this.fH, this.fM)
      .filter(c => c !== this.citaEditando);
    const maxPac = TIPO_CITA[this.fTipo].maxPac;
    if (citasEnSlot.length >= maxPac) {
      alert(`Este slot ya tiene el máximo de pacientes para ${TIPO_CITA[this.fTipo].n} (${maxPac})`);
      return;
    }
    // aquí iría la llamada al servicio para crear/actualizar
    this.cerrarModal();
    this.cargarCitas();
  }

  eliminarCita(): void {
    if (!this.citaEditando) return;
    // aquí iría la llamada al servicio para eliminar
    this.cerrarModal();
    this.cargarCitas();
  }

  // ── navegación ─────────────────────────────────────────────────────────────
  verDetalle(id: string): void { this.router.navigate(['/citas', id]); }
}