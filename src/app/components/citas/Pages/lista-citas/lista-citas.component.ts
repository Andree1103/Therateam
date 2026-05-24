import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CitaService } from '../../Services/cita.service';
import { Cita, CrearCitaLocalRequest, TipoTerapia } from '../../Models/cita.model';

export interface DiaSemana { nombre: string; fecha: Date; }
export interface Slot { h: number; m: number; lbl: string; }
export type TipoCita = 'conv' | 'pers' | 'kids';
export type EstadoCita = 'azul' | 'verde' | 'rojo';

@Component({
  selector: 'app-lista-citas',
  templateUrl: './lista-citas.component.html',
  styleUrls: ['./lista-citas.component.css']
})
export class ListaCitasComponent implements OnInit {

  citas: Cita[] = [];
  loading = true;
  tiposTerapia: TipoTerapia[] = [];

  filtroTerapeuta = '';
  vista: 'semana' | 'libre' = 'semana';
  configVisible = false;

  fechaInicioSemana!: Date;
  diasSemana: DiaSemana[] = [];
  weekLabel = '';
  slots: Slot[] = [];

  modalAbierto = false;
  modoFormulario: 'regular' | 'kids' = 'regular';
  citaEditando: Cita | null = null;

  fPac = ''; fPacDni = ''; fPacTel = ''; fPacCorreo = '';
  fPac2 = ''; fPac2Dni = ''; fPac2Tel = ''; fPac2Correo = '';
  fTer = ''; fTipo: TipoCita = 'conv';
  fDia = 0; fH = 8; fM = 0; fDur = 45; fEst: EstadoCita = 'azul';
  fObs = '';

  readonly ESTADOS: { v: EstadoCita; lbl: string }[] = [
    { v: 'azul',  lbl: 'Agendado'   },
    { v: 'verde', lbl: 'Asistió'    },
    { v: 'rojo',  lbl: 'No asistió' },
  ];
  readonly DIAS_NOM = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  get terapeutas(): string[] {
    return [...new Set(this.citas.map(c => c.terapeuta_nombre ?? ''))].filter(n => n);
  }

  get regularTipos(): TipoTerapia[] {
    return this.tiposTerapia.filter(t => t.id !== 'kids');
  }

  constructor(private citaService: CitaService, private router: Router) {}

  ngOnInit(): void {
    this.tiposTerapia = this.citaService.getTiposTerapia();
    this.generarSlots();
    this.irHoy();
  }

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

  cargarCitas(): void {
    this.loading = true;
    this.citaService.getCitas().subscribe({
      next: citas => { this.citas = citas; this.loading = false; },
      error: err  => { console.error(err); this.loading = false; }
    });
  }

  private recargarSilencioso(): void {
    this.citaService.getCitas().subscribe({
      next: citas => { this.citas = citas; },
      error: err  => console.error(err)
    });
  }

  getCitasSlot(diaIdx: number, h: number, m: number): Cita[] {
    const fecha = this.diasSemana[diaIdx]?.fecha;
    if (!fecha) return [];
    return this.citas.filter(c => {
      const ini = new Date(c.fecha_inicio);
      return ini.getFullYear() === fecha.getFullYear() &&
             ini.getMonth()    === fecha.getMonth()    &&
             ini.getDate()     === fecha.getDate()     &&
             ini.getHours()    === h                   &&
             ini.getMinutes()  === m                   &&
             (!this.filtroTerapeuta || c.terapeuta_nombre === this.filtroTerapeuta);
    });
  }

  getCitasSlotTer(diaIdx: number, h: number, m: number, terapeuta: string): Cita[] {
    const fecha = this.diasSemana[diaIdx]?.fecha;
    if (!fecha) return [];
    return this.citas.filter(c => {
      const ini = new Date(c.fecha_inicio);
      return ini.getFullYear() === fecha.getFullYear() &&
             ini.getMonth()    === fecha.getMonth()    &&
             ini.getDate()     === fecha.getDate()     &&
             ini.getHours()    === h                   &&
             ini.getMinutes()  === m                   &&
             c.terapeuta_nombre === terapeuta;
    });
  }

  getTipo(key: string): TipoTerapia {
    return this.tiposTerapia.find(t => t.id === key) ?? this.tiposTerapia[0];
  }

  getSlotLibresDia(terapeuta: string, diaIdx: number): { slot: Slot; libre: number }[] {
    return this.slots.map(s => {
      const citasAqui = this.getCitasSlotTer(diaIdx, s.h, s.m, terapeuta);
      const maxPac = citasAqui.length > 0
        ? this.getTipo(citasAqui[0].tipo_terapia_key ?? 'conv').max_pacientes
        : 1;
      const libre = Math.max(0, maxPac - citasAqui.length);
      return { slot: s, libre };
    }).filter(x => x.libre > 0);
  }

  getResumenLibres(): { terapeuta: string; dias: number[]; total: number }[] {
    return this.terapeutas.map(ter => {
      const dias = this.diasSemana.map((_, di) => this.getSlotLibresDia(ter, di).length);
      return { terapeuta: ter, dias, total: dias.reduce((a, b) => a + b, 0) };
    }).sort((a, b) => b.total - a.total);
  }

  getLibresTerapeuta(terapeuta: string): number {
    let libre = 0;
    for (let di = 0; di < 7; di++) libre += this.getSlotLibresDia(terapeuta, di).length;
    return libre;
  }

  esHoy(fecha: Date): boolean {
    const h = new Date();
    return fecha.getDate()     === h.getDate()     &&
           fecha.getMonth()    === h.getMonth()    &&
           fecha.getFullYear() === h.getFullYear();
  }

  getEstadoClass(cita: Cita): EstadoCita {
    if (cita.estado === 'ASISTIDA')   return 'verde';
    if (cita.estado === 'NO_ASISTIO') return 'rojo';
    return 'azul';
  }

  getDurInfo(): string {
    const tipo = this.getTipo(this.fTipo);
    if (this.fTipo === 'conv') {
      return `Convencional: hasta ${tipo.max_pacientes} pacientes simultáneos · ${this.fDur} min`;
    }
    return `${tipo.nombre}: duración fija ${tipo.duracion_minutos} min · 1 paciente por slot`;
  }

  getSlotLbl(): string {
    return this.slots.find(s => s.h === this.fH && s.m === this.fM)?.lbl ?? '08:00';
  }

  onSlotChange(lbl: string): void {
    const s = this.slots.find(x => x.lbl === lbl);
    if (s) { this.fH = s.h; this.fM = s.m; }
  }

  onTipoChange(): void {
    if (this.fTipo === 'conv') {
      this.fDur = this.getTipo('conv').duracion_minutos;
    }
  }

  onDuracionTipoChange(tipo: TipoTerapia): void {
    this.citaService.updateDuracionTipo(tipo.id, tipo.duracion_minutos);
    if (this.fTipo === tipo.id && tipo.id === 'conv') {
      this.fDur = tipo.duracion_minutos;
    }
  }

  abrirNueva(): void {
    this.citaEditando = null;
    this.resetForm();
    this.modalAbierto = true;
  }

  abrirSlot(diaIdx: number, s: Slot): void {
    this.citaEditando = null;
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
    this.fPac      = `${cita.paciente_nombre ?? ''} ${cita.paciente_apellido ?? ''}`.trim();
    this.fPacDni   = cita.paciente_dni ?? '';
    this.fPacTel   = cita.paciente_telefono ?? '';
    this.fPacCorreo= cita.paciente_correo ?? '';
    this.fPac2 = ''; this.fPac2Dni = ''; this.fPac2Tel = ''; this.fPac2Correo = '';
    this.fTer  = cita.terapeuta_nombre ?? '';
    this.fTipo = (cita.tipo_terapia_key as TipoCita) ?? 'conv';
    this.fDia  = this.diasSemana.findIndex(d =>
      d.fecha.getDate() === ini.getDate() && d.fecha.getMonth() === ini.getMonth());
    if (this.fDia === -1) this.fDia = 0;
    this.fH    = ini.getHours();
    this.fM    = ini.getMinutes();
    this.fDur  = cita.duracion_minutos;
    this.fEst  = this.getEstadoClass(cita);
    this.fObs  = cita.observacion ?? '';
    this.modoFormulario = this.fTipo === 'kids' ? 'kids' : 'regular';
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; this.citaEditando = null; }

  resetForm(): void {
    this.fPac = ''; this.fPacDni = ''; this.fPacTel = ''; this.fPacCorreo = '';
    this.fPac2 = ''; this.fPac2Dni = ''; this.fPac2Tel = ''; this.fPac2Correo = '';
    this.fTer = this.terapeutas[0] ?? '';
    this.fTipo = 'conv';
    this.fDia = 0;
    this.fH = 8; this.fM = 0;
    this.fDur = this.getTipo('conv').duracion_minutos;
    this.fEst = 'azul';
    this.fObs = '';
    this.modoFormulario = 'regular';
  }

  cambiarModo(m: 'regular' | 'kids'): void {
    this.modoFormulario = m;
    this.fTipo = m === 'kids' ? 'kids' : 'conv';
    this.onTipoChange();
  }

  guardarCita(): void {
    if (!this.fPac.trim()) { alert('Ingrese el nombre del paciente'); return; }
    if (!this.fTer)        { alert('Seleccione un terapeuta');         return; }

    const tipo = this.getTipo(this.fTipo);
    const dur  = this.fTipo === 'conv' ? this.fDur : tipo.duracion_minutos;
    const agregarDos = !this.citaEditando && this.fTipo === 'conv' && this.fPac2.trim().length > 0;
    const nuevosCount = agregarDos ? 2 : 1;

    const fechaSlot = new Date(this.diasSemana[this.fDia].fecha);
    fechaSlot.setHours(this.fH, this.fM, 0, 0);
    const fechaFin = new Date(fechaSlot);
    fechaFin.setMinutes(fechaFin.getMinutes() + dur);

    const conflictos = this.citas.filter(c => {
      if (c.terapeuta_nombre !== this.fTer) return false;
      if (this.citaEditando && c.id === this.citaEditando.id) return false;
      return fechaSlot < new Date(c.fecha_fin) && fechaFin > new Date(c.fecha_inicio);
    });

    if (conflictos.length + nuevosCount > tipo.max_pacientes) {
      const disponible = tipo.max_pacientes - conflictos.length;
      if (disponible <= 0) {
        alert(`Capacidad completa para ${tipo.nombre} (máx. ${tipo.max_pacientes} paciente(s) simultáneo(s))`);
      } else {
        alert(`Solo hay ${disponible} cupo(s) disponible(s) en ese horario. No se pueden agregar ${nuevosCount} pacientes a la vez.`);
      }
      return;
    }

    const buildReq = (nombre: string, dni: string, tel: string, correo: string): CrearCitaLocalRequest => {
      const partes = nombre.trim().split(' ');
      return {
        paciente_nombre:   partes[0] ?? '',
        paciente_apellido: partes.slice(1).join(' ') || '',
        paciente_dni:      dni || undefined,
        paciente_telefono: tel || undefined,
        paciente_correo:   correo || undefined,
        terapeuta_nombre:  this.fTer,
        tipo_key:          this.fTipo,
        tipo_nombre:       tipo.nombre,
        fecha_inicio:      fechaSlot,
        duracion_minutos:  dur,
        estado_color:      this.fEst,
        observacion:       this.fObs || undefined,
      };
    };

    const req1 = buildReq(this.fPac, this.fPacDni, this.fPacTel, this.fPacCorreo);

    const obs1 = this.citaEditando
      ? this.citaService.actualizarCitaLocal(this.citaEditando.id, req1)
      : this.citaService.crearCitaLocal(req1);

    if (agregarDos) {
      const req2 = buildReq(this.fPac2, this.fPac2Dni, this.fPac2Tel, this.fPac2Correo);
      obs1.subscribe({
        next: () => this.citaService.crearCitaLocal(req2).subscribe({
          next: () => { this.cerrarModal(); this.recargarSilencioso(); }
        })
      });
    } else {
      obs1.subscribe({ next: () => { this.cerrarModal(); this.recargarSilencioso(); } });
    }
  }

  eliminarCita(): void {
    if (!this.citaEditando || !confirm('¿Eliminar esta cita?')) return;
    this.citaService.eliminarCitaLocal(this.citaEditando.id).subscribe({
      next: () => { this.cerrarModal(); this.recargarSilencioso(); }
    });
  }

  verDetalle(id: string): void { this.router.navigate(['/citas', id]); }
}
