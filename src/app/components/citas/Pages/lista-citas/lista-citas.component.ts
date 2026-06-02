import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CitaService } from '../../Services/cita.service';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { AtencionMetrica, METRICAS_DEFAULT } from '../../../atencion-clinica/Models/atencion.model';
import { Cita, CrearCitaConPacienteRequest, CrearCitaLocalRequest, PacienteEnCita, TipoTerapia } from '../../Models/cita.model';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { terapeutaNombre } from '../../../terapeutas/Models/terapeuta.model';

export interface DiaSemana { nombre: string; fecha: Date; }
export interface Slot { h: number; m: number; lbl: string; }

export interface PacienteState {
  colapsado: boolean;
  modo: 'buscar' | 'encontrado' | 'nuevo';
  buscando: boolean;
  id: number | null;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string;
  correo: string;
}

@Component({
  selector: 'app-lista-citas',
  templateUrl: './lista-citas.component.html',
  styleUrls: ['./lista-citas.component.css']
})
export class ListaCitasComponent implements OnInit {

  citas: Cita[] = [];
  loading = true;
  cargandoCatalogos = true;
  guardando = false;

  tiposTerapia: TipoTerapia[] = [];
  estadosCita:  CatalogItem[] = [];
  modalidades:  CatalogItem[] = [];
  terapeutasNombres: string[] = [];

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

  pac1: PacienteState = this.emptyPac();
  pac2: PacienteState = this.emptyPac();
  pac2habilitado = false;

  fTer = '';
  fTipoId = '';
  fEstKey = '';
  fModalidad = 'PRESENCIAL';
  fDia = 0; fH = 8; fM = 0; fDur = 45;
  fObs = '';

  // ── Atención Clínica ─────────────────────────────────────────────────────────
  modalAtencion = false;
  guardandoAtencion = false;
  citaParaAtencion: Cita | null = null;
  atencionNotas = '';
  atencionMetricas: AtencionMetrica[] = [];

  readonly DIAS_NOM = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  constructor(
    private citaService: CitaService,
    private terapeutaService: TerapeutaService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private router: Router,
    private atencionService: AtencionClinicaService
  ) {}

  ngOnInit(): void {
    this.generarSlots();
    this.irHoy();
    this.cargarCatalogos();
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get tiposRegulares(): TipoTerapia[] { return this.tiposTerapia.filter(t => t.id !== 'KIDS'); }
  get tipoKids(): TipoTerapia | undefined { return this.tiposTerapia.find(t => t.id === 'KIDS'); }
  get tipoSeleccionado(): TipoTerapia | undefined { return this.tiposTerapia.find(t => t.id === this.fTipoId); }
  get esMultipaciente(): boolean { return (this.tipoSeleccionado?.max_pacientes ?? 1) > 1; }

  get pac1Resumen(): string {
    if (this.pac1.nombre) return `${this.pac1.nombre} ${this.pac1.apellido}`.trim();
    if (this.pac1.dni)    return `DNI: ${this.pac1.dni}`;
    return 'Sin datos';
  }

  get pac2Resumen(): string {
    if (this.pac2.nombre) return `${this.pac2.nombre} ${this.pac2.apellido}`.trim();
    if (this.pac2.dni)    return `DNI: ${this.pac2.dni}`;
    return 'Sin datos';
  }

  // ── Carga de datos ───────────────────────────────────────────────────────────

  private cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    forkJoin({
      tipos:       this.citaService.getTiposTerapiaFromApi(),
      estados:     this.catalogService.getEstadosCita(),
      modalidades: this.catalogService.getModalidades(),
      terapeutas:  this.terapeutaService.getAll(),
    }).subscribe({
      next: ({ tipos, estados, modalidades, terapeutas }) => {
        this.tiposTerapia      = tipos;
        this.estadosCita       = estados;
        this.modalidades       = modalidades;
        this.terapeutasNombres = terapeutas.map(t => terapeutaNombre(t)).filter(Boolean);
        this.cargandoCatalogos = false;
        this.resetForm();
      },
      error: () => { this.cargandoCatalogos = false; this.resetForm(); }
    });
  }

  generarSlots(): void {
    this.slots = [];
    for (let h = 8; h < 20; h++) {
      for (const m of [0, 40]) {
        this.slots.push({ h, m, lbl: `${String(h).padStart(2,'0')}:${m === 0 ? '00' : '40'}` });
      }
    }
  }

  irHoy(): void {
    const hoy = new Date();
    const dow  = hoy.getDay();
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
    this.weekLabel = `${this.fechaInicioSemana.toLocaleDateString('es-PE', opts)} – ${this.diasSemana[6].fecha.toLocaleDateString('es-PE', opts)}`;
  }

  cargarCitas(): void {
    this.loading = true;
    this.citaService.getCitas().subscribe({
      next: citas => { this.citas = citas; this.loading = false; },
      error: ()    => { this.loading = false; }
    });
  }

  private recargarSilencioso(): void {
    this.citaService.getCitas().subscribe({ next: citas => { this.citas = citas; } });
  }

  // ── Helpers de estado, tipo, chips ───────────────────────────────────────────

  getTipo(id: string): TipoTerapia {
    return this.tiposTerapia.find(t => t.id === id)
      ?? { id, nombre: id, duracion_minutos: 45, max_pacientes: 1 };
  }

  getEstadoColor(key: string): string {
    return this.estadosCita.find(e => e.key === key)?.colorHex ?? '#94a3b8';
  }

  getChipStyle(cita: Cita): Record<string, string> {
    const color = this.getEstadoColor(cita.estado);
    return { 'border-left': `3px solid ${color}`, 'background': `${color}1a` };
  }

  // ── Slots y vistas ─────────────────────────────────────────────────────────

  getCitasSlot(diaIdx: number, h: number, m: number): Cita[] {
    const fecha = this.diasSemana[diaIdx]?.fecha;
    if (!fecha) return [];
    return this.citas.filter(c => {
      const ini = new Date(c.fecha_inicio);
      return ini.getFullYear() === fecha.getFullYear() &&
             ini.getMonth()    === fecha.getMonth()    &&
             ini.getDate()     === fecha.getDate()     &&
             ini.getHours()    === h && ini.getMinutes() === m &&
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
             ini.getHours()    === h && ini.getMinutes() === m &&
             c.terapeuta_nombre === terapeuta;
    });
  }

  getSlotLibresDia(terapeuta: string, diaIdx: number): { slot: Slot; libre: number }[] {
    return this.slots.map(s => {
      const citasAqui = this.getCitasSlotTer(diaIdx, s.h, s.m, terapeuta);
      const maxPac = citasAqui.length > 0
        ? this.getTipo((citasAqui[0].tipo_terapia_key ?? '').toUpperCase()).max_pacientes
        : 1;
      return { slot: s, libre: Math.max(0, maxPac - citasAqui.length) };
    }).filter(x => x.libre > 0);
  }

  getResumenLibres(): { terapeuta: string; dias: number[]; total: number }[] {
    return this.terapeutasNombres.map(ter => {
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
    return fecha.getDate() === h.getDate() && fecha.getMonth() === h.getMonth() && fecha.getFullYear() === h.getFullYear();
  }

  getDurInfo(): string {
    const tipo = this.tipoSeleccionado;
    if (!tipo) return '';
    return this.esMultipaciente
      ? `${tipo.nombre}: hasta ${tipo.max_pacientes} pacientes simultáneos · ${this.fDur} min`
      : `${tipo.nombre}: duración fija ${tipo.duracion_minutos} min · 1 paciente por slot`;
  }

  getSlotLbl(): string { return this.slots.find(s => s.h === this.fH && s.m === this.fM)?.lbl ?? '08:00'; }
  onSlotChange(lbl: string): void { const s = this.slots.find(x => x.lbl === lbl); if (s) { this.fH = s.h; this.fM = s.m; } }

  onTipoChange(): void {
    const tipo = this.tipoSeleccionado;
    if (tipo && this.esMultipaciente) this.fDur = tipo.duracion_minutos;
  }

  onDuracionTipoChange(tipo: TipoTerapia): void {
    const t = this.tiposTerapia.find(x => x.id === tipo.id);
    if (t) t.duracion_minutos = tipo.duracion_minutos;
    if (this.fTipoId === tipo.id && this.esMultipaciente) this.fDur = tipo.duracion_minutos;
  }

  // ── Búsqueda de paciente por DNI ──────────────────────────────────────────

  buscarDni(pac: PacienteState): void {
    const dni = pac.dni.trim();
    if (!dni) { this.toast.warning('Ingresa un DNI para buscar'); return; }
    pac.buscando = true;
    this.citaService.buscarPorDni(dni).subscribe({
      next: encontrado => {
        pac.buscando = false;
        if (encontrado) {
          pac.id       = encontrado.id;
          pac.nombre   = encontrado.nombre;
          pac.apellido = encontrado.apellido;
          pac.telefono = encontrado.telefono ?? '';
          pac.correo   = encontrado.correo   ?? '';
          pac.modo     = 'encontrado';
          pac.colapsado = true;
        } else {
          pac.id     = null;
          pac.nombre = ''; pac.apellido = ''; pac.telefono = ''; pac.correo = '';
          pac.modo   = 'nuevo';
        }
      },
      error: () => { pac.buscando = false; pac.modo = 'nuevo'; pac.id = null; }
    });
  }

  cambiarPaciente(pac: PacienteState): void {
    pac.modo = 'buscar';
    pac.id = null;
    pac.nombre = ''; pac.apellido = ''; pac.telefono = ''; pac.correo = '';
    pac.colapsado = false;
  }

  togglePac(pac: PacienteState): void {
    if (pac.modo !== 'buscar') pac.colapsado = !pac.colapsado;
  }

  // ── Modal ────────────────────────────────────────────────────────────────────

  abrirNueva(): void { this.citaEditando = null; this.resetForm(); this.modalAbierto = true; }

  abrirSlot(diaIdx: number, s: Slot): void {
    this.citaEditando = null; this.resetForm();
    this.fDia = diaIdx; this.fH = s.h; this.fM = s.m;
    this.modalAbierto = true;
  }

  abrirEditar(cita: Cita, e: Event): void {
    e.stopPropagation();
    this.citaEditando = cita;
    const ini = new Date(cita.fecha_inicio);
    this.pac1 = {
      colapsado: true, modo: 'encontrado', buscando: false,
      id: null,
      dni:      cita.paciente_dni      ?? '',
      nombre:   cita.paciente_nombre   ?? '',
      apellido: cita.paciente_apellido ?? '',
      telefono: cita.paciente_telefono ?? '',
      correo:   cita.paciente_correo   ?? '',
    };
    this.pac2 = this.emptyPac();
    this.pac2habilitado = false;
    this.fTer       = cita.terapeuta_nombre ?? '';
    this.fTipoId    = (cita.tipo_terapia_key ?? '').toUpperCase() || (this.tiposTerapia[0]?.id ?? '');
    this.fEstKey    = cita.estado;
    this.fModalidad = (cita.modalidad as string) || 'PRESENCIAL';
    this.fDia    = this.diasSemana.findIndex(d =>
      d.fecha.getDate() === ini.getDate() && d.fecha.getMonth() === ini.getMonth());
    if (this.fDia === -1) this.fDia = 0;
    this.fH = ini.getHours(); this.fM = ini.getMinutes();
    this.fDur = cita.duracion_minutos;
    this.fObs = cita.observacion ?? cita.notas_previas ?? '';
    this.modoFormulario = this.fTipoId === 'KIDS' ? 'kids' : 'regular';
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; this.citaEditando = null; }

  resetForm(): void {
    this.pac1 = this.emptyPac();
    this.pac2 = this.emptyPac();
    this.pac2habilitado = false;
    this.fTer    = this.terapeutasNombres[0] ?? '';
    const primerTipo = this.tiposTerapia.find(t => t.id !== 'KIDS') ?? this.tiposTerapia[0];
    this.fTipoId = primerTipo?.id ?? '';
    this.fDia = 0; this.fH = 8; this.fM = 0;
    this.fDur    = primerTipo?.duracion_minutos ?? 45;
    this.fEstKey    = this.estadosCita[0]?.key  ?? 'PROGRAMADA';
    this.fModalidad = this.modalidades[0]?.key  ?? 'PRESENCIAL';
    this.fObs       = '';
    this.modoFormulario = 'regular';
  }

  cambiarModo(m: 'regular' | 'kids'): void {
    this.modoFormulario = m;
    if (m === 'kids') {
      this.fTipoId = this.tipoKids?.id ?? 'KIDS';
      this.pac2habilitado = false;
    } else {
      const regular = this.tiposTerapia.find(t => t.id !== 'KIDS');
      this.fTipoId = regular?.id ?? '';
    }
    this.onTipoChange();
  }

  guardarCita(): void {
    if (!this.pac1.nombre.trim() || !this.pac1.apellido.trim()) {
      this.toast.warning('Completa los datos del paciente 1'); return;
    }
    if (!this.fTer)    { this.toast.warning('Selecciona un terapeuta');        return; }
    if (!this.fTipoId) { this.toast.warning('Selecciona un tipo de terapia'); return; }

    const tipo = this.tipoSeleccionado!;
    const dur  = this.esMultipaciente ? this.fDur : tipo.duracion_minutos;

    const fechaSlot = new Date(this.diasSemana[this.fDia].fecha);
    fechaSlot.setHours(this.fH, this.fM, 0, 0);
    const fechaFin = new Date(fechaSlot);
    fechaFin.setMinutes(fechaFin.getMinutes() + dur);

    // Conflicto de capacidad
    const nuevosCount = (this.esMultipaciente && this.pac2habilitado && this.pac2.nombre.trim()) ? 2 : 1;
    const conflictos = this.citas.filter(c => {
      if (c.terapeuta_nombre !== this.fTer) return false;
      if (this.citaEditando && c.id === this.citaEditando.id) return false;
      return fechaSlot < new Date(c.fecha_fin) && fechaFin > new Date(c.fecha_inicio);
    });
    if (conflictos.length + nuevosCount > tipo.max_pacientes) {
      const disponible = tipo.max_pacientes - conflictos.length;
      this.toast.error(disponible <= 0
        ? `Capacidad completa (máx. ${tipo.max_pacientes} pac.)`
        : `Solo hay ${disponible} cupo(s) disponible(s)`);
      return;
    }

    this.guardando = true;

    if (this.citaEditando) {
      // EDITAR — usa endpoint local existente
      const req: CrearCitaLocalRequest = {
        // FK @ManyToOne — IDs para que buildBody() los envíe como { id }
        terapeuta_id: Number(this.citaEditando!.terapeuta_id) || undefined,
        sesion_id:    this.citaEditando!.sesion_id             || undefined,
        estado_id:    this.estadosCita.find(e => e.key === this.fEstKey)?.id,
        modalidad_id: this.modalidades.find(m => m.key === this.fModalidad)?.id,
        // Campos de la cita
        fecha_inicio:     fechaSlot,
        duracion_minutos: dur,
        notas_previas:    this.fObs || undefined,
        // Helpers
        terapeuta_nombre:  this.fTer,
        tipo_key:          this.fTipoId,
        tipo_nombre:       tipo.nombre,
        estado_key:        this.fEstKey,
        modalidad_key:     this.fModalidad,
        paciente_nombre:   this.pac1.nombre,
        paciente_apellido: this.pac1.apellido,
        paciente_dni:      this.pac1.dni      || undefined,
        paciente_telefono: this.pac1.telefono || undefined,
        paciente_correo:   this.pac1.correo   || undefined,
        observacion:       this.fObs || undefined,
      };
      this.citaService.actualizarCitaLocal(this.citaEditando.id, req).subscribe({
        next: () => { this.toast.success('Cita actualizada correctamente'); this.cerrarModal(); this.recargarSilencioso(); this.guardando = false; },
        error: () => { this.toast.error('Error al actualizar la cita'); this.guardando = false; }
      });
    } else {
      // CREAR — usa endpoint atómico con paciente
      const buildPac = (p: PacienteState): PacienteEnCita => ({
        id:       p.id ?? undefined,
        dni:      p.dni,
        nombre:   p.nombre,
        apellido: p.apellido,
        telefono: p.telefono || undefined,
        correo:   p.correo   || undefined,
      });

      const req: CrearCitaConPacienteRequest = {
        paciente:  buildPac(this.pac1),
        paciente2: (this.esMultipaciente && this.pac2habilitado && this.pac2.nombre.trim())
                    ? buildPac(this.pac2) : null,
        terapeutaNombre: this.fTer,
        tipoKey:         this.fTipoId,
        fechaInicio:     this.toLocalDT(fechaSlot),
        duracionMinutos: dur,
        estadoKey:       this.fEstKey,
        modalidadKey:    this.fModalidad,
        observacion:     this.fObs || undefined,
      };

      this.citaService.crearConPaciente(req).subscribe({
        next: () => { this.toast.success('Cita creada correctamente'); this.cerrarModal(); this.recargarSilencioso(); this.guardando = false; },
        error: () => { this.toast.error('Error al crear la cita'); this.guardando = false; }
      });
    }
  }

  eliminarCita(): void {
    if (!this.citaEditando) return;
    if (!confirm('¿Eliminar esta cita?')) return;
    this.citaService.eliminarCitaLocal(this.citaEditando.id).subscribe({
      next: () => { this.toast.success('Cita eliminada correctamente'); this.cerrarModal(); this.recargarSilencioso(); },
      error: () => { this.toast.error('Error al eliminar la cita') }
    });
  }

  // ── Atención Clínica ──────────────────────────────────────────────────────────

  abrirAtencion(cita: Cita, e: Event): void {
    e.stopPropagation();
    this.citaParaAtencion = cita;
    this.atencionNotas    = cita.notas_previas ?? '';
    this.atencionMetricas = METRICAS_DEFAULT.map(m => ({ ...m }));
    this.modalAtencion    = true;
  }

  cerrarAtencion(): void {
    this.modalAtencion     = false;
    this.citaParaAtencion  = null;
    this.atencionNotas     = '';
    this.atencionMetricas  = [];
  }

  guardarAtencion(): void {
    if (!this.citaParaAtencion) return;
    this.guardandoAtencion = true;
    const now = new Date().toISOString().slice(0, 19);
    const payload = {
      citaId:         Number(this.citaParaAtencion.id),
      fechaInicioReal: now,
      notasPost:      this.atencionNotas || undefined,
      metricas:       this.atencionMetricas.filter(m => m.valor !== null),
    };
    this.atencionService.crear(payload).subscribe({
      next: () => {
        this.toast.success('Atención registrada correctamente');
        this.cerrarAtencion();
        this.recargarSilencioso();
        this.guardandoAtencion = false;
      },
      error: () => {
        this.toast.error('Error al registrar la atención');
        this.guardandoAtencion = false;
      }
    });
  }

  verDetalle(id: string): void { this.router.navigate(['/citas', id]); }

  private emptyPac(): PacienteState {
    return { colapsado: false, modo: 'buscar', buscando: false, id: null, dni: '', nombre: '', apellido: '', telefono: '', correo: '' };
  }

  private toLocalDT(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
