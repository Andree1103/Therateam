import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { PacienteService, PacienteFiltros } from '../../Services/paciente.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { Paciente, PacienteForm } from '../../Models/paciente.model';
import { CatalogItem, Sede } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { TerapeutaHorarioService } from '../../../terapeutas/Services/terapeuta-horario.service';
import { Terapeuta } from '../../../terapeutas/Models/terapeuta.model';
import { TerapeutaHorario } from '../../../terapeutas/Models/terapeuta-horario.model';
import { HorarioFijo, HorarioFijoRequest, DIAS_SEMANA, soloHoraYMinuto } from '../../Models/horario-fijo.model';

@Component({
  selector: 'app-lista-pacientes',
  templateUrl: './lista-pacientes.component.html',
  styleUrls: ['./lista-pacientes.component.css']
})
export class ListaPacientesComponent implements OnInit {
  /** Exportar a Excel se habilita por ROL (Seguridad > Roles). */
  get puedeExportar(): boolean { return this.authService.puedeExportar(); }


  pacientes: Paciente[] = [];
  loading = false;
  guardando = false;
  eliminando = false;

  filtroNombre = '';
  filtroDni = '';
  filtroCorreo = '';
  filtroSedeId: number | null = null;
  filtroActivo = '';

  // ── Paginación server-side ───────────────────────────────────────────────
  readonly tamanioPaginaOpciones = [5, 10, 15, 20];
  paginaActual = 0;
  tamanioPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;

  modalAbierto = false;
  editando: Paciente | null = null;

  pacienteAEliminar: Paciente | null = null;
  modalEliminar = false;

  sedes: Sede[] = [];
  origenes: CatalogItem[] = [];
  cargandoCatalogos = true;

  // Declarado después de `sedes` porque emptyForm() lee this.sedes[0] — los inicializadores
  // de campos en TS corren en orden de declaración, así que si formData va antes, sedes
  // todavía es undefined en ese momento.
  formData: PacienteForm = this.emptyForm();

  get total() { return this.totalElementos; }

  exportando = false;

  constructor(
    private pacienteService: PacienteService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private authService: AuthService,
    private excelExportService: ExcelExportService,
    private terapeutaService: TerapeutaService,
    private terapeutaHorarioService: TerapeutaHorarioService
  ) {}

  /** Exporta TODOS los pacientes que cumplen los filtros activos (no solo la página visible). */
  // ── Exportar a Excel con rango de fecha de ALTA del paciente ──────────────
  // El rango es opcional: vacio exporta todo lo que cumpla los filtros de la lista, que es
  // como funcionaba antes. Sirve para bajar cada dia solo los pacientes nuevos.
  modalExportar = false;
  exportDesde = '';
  exportHasta = '';

  abrirExportar(): void { this.modalExportar = true; }
  cerrarExportar(): void { this.modalExportar = false; }

  get rangoExportInvalido(): boolean {
    return !!(this.exportDesde && this.exportHasta && this.exportDesde > this.exportHasta);
  }

  /** Fecha local (no UTC): toISOString() adelanta el dia en Peru (UTC-5) cerca de medianoche. */
  private fechaLocalISO(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Atajos del modal: 0 = hoy, N = los ultimos N dias contando hoy. */
  rangoExportRapido(dias: number): void {
    const hoy = new Date();
    const desde = new Date();
    if (dias > 0) desde.setDate(desde.getDate() - dias);
    this.exportDesde = this.fechaLocalISO(desde);
    this.exportHasta = this.fechaLocalISO(hoy);
  }

  limpiarRangoExport(): void { this.exportDesde = ''; this.exportHasta = ''; }

  exportarExcel(): void {
    if (this.rangoExportInvalido) {
      this.toast.warning('La fecha inicial no puede ser posterior a la final');
      return;
    }
    this.exportando = true;
    const filtros: PacienteFiltros = {
      nombre: this.filtroNombre,
      dni: this.filtroDni,
      correo: this.filtroCorreo,
      sedeId: this.filtroSedeId,
      activo: this.filtroActivo === '' ? null : this.filtroActivo === 'true',
      creadoDesde: this.exportDesde || null,
      creadoHasta: this.exportHasta || null,
    };
    this.pacienteService.getAllPaged(0, 10000, filtros).subscribe({
      next: res => {
        this.exportando = false;
        if (res.content.length === 0) { this.toast.warning('No hay pacientes para exportar con los filtros actuales'); return; }
        this.modalExportar = false;
        const filas = res.content.map(p => ({
          'Nombre': p.nombre,
          'Apellido': p.apellido,
          'DNI': p.dni ?? '',
          'Teléfono': p.telefono ?? '',
          'Correo': p.correo ?? '',
          'Fecha de nacimiento': p.fechaNacimiento ?? '',
          'DNI apoderado': p.dniApoderado ?? '',
          'Nombre apoderado': p.nombreApoderado ?? '',
          'Celular apoderado': p.celularApoderado ?? '',
          'Sede': p.sede?.nombre ?? '',
          'Origen': p.origen?.nombre ?? '',
          'Activo': p.activo ? 'Sí' : 'No',
          'Notas': p.notas ?? '',
          'Fecha de alta': p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-PE') : '',
          'Usuario creación': p.usuarioCreacionNombre ?? '',
        }));
        const sufijo = this.exportDesde || this.exportHasta
          ? `_altas_${this.exportDesde || 'inicio'}_a_${this.exportHasta || 'hoy'}` : '';
        this.excelExportService.exportar(filas, `pacientes${sufijo}`);
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar pacientes'); }
    });
  }

  get puedeCrear(): boolean { return this.authService.puedeCrear('PACIENTES'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('PACIENTES'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('PACIENTES'); }

  /** Terapeuta restringido a sus propias citas: esta pantalla solo trae sus pacientes atendidos. */
  get vistaRestringida(): boolean { return this.authService.currentUserValue?.citasSoloPropias ?? false; }
  get tituloPagina(): string { return this.vistaRestringida ? 'Mis atendidos' : 'Pacientes'; }

  ngOnInit(): void {
    this.cargar();
    this.cargarCatalogos();
  }

  private cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    let pendientes = 2;
    const listo = () => { if (--pendientes === 0) this.cargandoCatalogos = false; };
    this.catalogService.getSedes().subscribe(d => { this.sedes = d; listo(); });
    this.catalogService.getOrigenes().subscribe(d => { this.origenes = d; listo(); });

    // Lo que alimenta el bloque de horario fijo. No cuenta para `cargandoCatalogos` porque ese
    // flag bloquea sede y origen, que son obligatorios: el horario fijo es opcional y no debe
    // impedir crear un paciente si algo de esto falla.
    this.terapeutaService.getAll().pipe(catchError(() => of([] as Terapeuta[])))
      .subscribe(d => this.terapeutas = d);
    this.catalogService.getTiposTerapia().pipe(catchError(() => of([] as CatalogItem[])))
      .subscribe(d => this.tiposTerapia = d);
    // Todos los horarios en una peticion: pedirlos por terapeuta serian N llamadas al abrir.
    this.terapeutaHorarioService.getAll().pipe(catchError(() => of([] as TerapeutaHorario[])))
      .subscribe(d => this.horariosTerapeutas = d);
  }

  cargar(): void {
    this.loading = true;
    const filtros: PacienteFiltros = {
      nombre: this.filtroNombre,
      dni: this.filtroDni,
      correo: this.filtroCorreo,
      sedeId: this.filtroSedeId,
      activo: this.filtroActivo === '' ? null : this.filtroActivo === 'true',
    };
    this.pacienteService.getAllPaged(this.paginaActual, this.tamanioPagina, filtros).subscribe({
      next: res => {
        this.pacientes = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /** Los filtros solo se aplican al clic en "Buscar" (o Enter) — nunca mientras se tipea. */
  buscar(): void {
    this.paginaActual = 0;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroNombre = '';
    this.filtroDni = '';
    this.filtroCorreo = '';
    this.filtroSedeId = null;
    this.filtroActivo = '';
    this.buscar();
  }

  cambiarTamanioPagina(size: number): void {
    this.tamanioPagina = size;
    this.paginaActual = 0;
    this.cargar();
  }

  irAPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas || p === this.paginaActual) return;
    this.paginaActual = p;
    this.cargar();
  }

  abrirNuevo(): void {
    if (!this.puedeCrear) return;
    this.editando = null;
    this.formData = this.emptyForm();
    this.limpiarHorarioFijo();
    this.modalAbierto = true;
  }

  abrirEditar(p: Paciente): void {
    if (!this.puedeEditar) return;
    this.editando = p;
    this.formData = {
      nombre:            p.nombre,
      apellido:          p.apellido,
      dni:               p.dni               || '',
      telefono:          p.telefono          || '',
      correo:            p.correo            || '',
      fechaNacimiento:   p.fechaNacimiento   || '',
      dniApoderado:      p.dniApoderado      || '',
      nombreApoderado:   p.nombreApoderado   || '',
      celularApoderado:  p.celularApoderado  || '',
      notas:             p.notas             || '',
      activo:            p.activo            ?? true,
      sedeId:            p.sede?.id          ?? null,
      origenId:          p.origen?.id        ?? null,
    };
    this.limpiarHorarioFijo();
    if (p.id) {
      this.pacienteService.getHorariosFijos(p.id).pipe(catchError(() => of([] as HorarioFijo[])))
        .subscribe(lista => {
          this.horariosFijos = lista.map(h => ({
            terapeutaId:   h.terapeuta?.id as number,
            tipoTerapiaId: h.tipoTerapia?.id ?? null,
            diaSemana:     h.diaSemana,
            horaInicio:    soloHoraYMinuto(h.horaInicio),
            horaFin:       h.horaFin ? soloHoraYMinuto(h.horaFin) : null,
            notas:         h.notas ?? null,
          }));
        });
    }
    this.modalAbierto = true;
  }

  /** true si la fecha de nacimiento ingresada corresponde a un menor de 18 años — controla si los
   *  campos del apoderado se muestran y son obligatorios en el formulario. */
  get esMenorDeEdad(): boolean {
    if (!this.formData.fechaNacimiento) return false;
    const nacimiento = new Date(this.formData.fechaNacimiento);
    if (isNaN(nacimiento.getTime())) return false;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const noCumplioAunEsteAnio = hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
    if (noCumplioAunEsteAnio) edad--;
    return edad < 18;
  }

  cerrarModal(): void { this.modalAbierto = false; }

  /**
   * Manda el horario fijo una vez que el paciente ya existe.
   *
   * Al crear solo se llama si hay algo que guardar: una lista vacía borraría, y en un paciente
   * nuevo no hay nada que borrar. Al editar sí se manda vacía, porque quitar todas las líneas es
   * precisamente cómo se le sacan los horarios.
   */
  private guardarHorarioFijoDe(paciente: Paciente, esEdicion: boolean): void {
    if (!paciente?.id) return;
    if (!esEdicion && this.horariosFijos.length === 0) return;
    this.pacienteService.guardarHorariosFijos(paciente.id, this.horariosFijos).subscribe({
      error: (err) => this.toast.warning(
        (err?.error?.error || 'No se pudo guardar el horario fijo') + ' — el paciente sí quedó guardado.')
    });
  }

  // ── Horario fijo del paciente (opcional) ──────────────────────────────────
  // Es una anotacion de referencia: no reserva el espacio en la agenda ni genera citas. Sirve
  // para saber si el paciente tiene horarios fijos, en que terapias y con que terapeutas.
  //
  // Se edita como borrador en memoria y se manda de una sola vez al guardar el paciente, porque
  // al crearlo todavia no hay id contra el cual colgar los horarios.

  readonly DIAS = DIAS_SEMANA;

  terapeutas: Terapeuta[] = [];
  tiposTerapia: CatalogItem[] = [];
  /** Horario semanal de TODOS los terapeutas, de una sola peticion. */
  private horariosTerapeutas: TerapeutaHorario[] = [];

  horariosFijos: HorarioFijoRequest[] = [];
  hfTerapeutaId: number | null = null;
  hfTipoTerapiaId: number | null = null;
  hfDiaSemana: number | null = null;
  hfHoraInicio: string | null = null;
  hfError = '';

  nombreTerapeuta(id?: number | null): string {
    if (!id) return '—';
    const t = this.terapeutas.find(x => x.id === id);
    if (!t) return `Terapeuta #${id}`;
    const nombre = `${t.nombre ?? t.usuario?.nombre ?? ''} ${t.apellido ?? t.usuario?.apellido ?? ''}`.trim();
    return nombre || `Terapeuta #${id}`;
  }

  nombreTipoTerapia(id?: number | null): string {
    return this.tiposTerapia.find(t => t.id === id)?.nombre ?? '—';
  }

  /** Los dias que el terapeuta elegido realmente trabaja, en orden. */
  diasDelTerapeuta(): number[] {
    if (!this.hfTerapeutaId) return [];
    const dias = this.horariosTerapeutas
      .filter(h => this.idDelHorario(h) === this.hfTerapeutaId && h.activo)
      .map(h => h.diaSemana);
    return [...new Set(dias)].sort((a, b) => a - b);
  }

  /**
   * Las horas en punto y media dentro de la jornada del terapeuta ese dia. Se generan a partir
   * de su horario real en vez de ofrecer un reloj completo: elegir una hora en la que no atiende
   * es un error que no tiene por que llegar a guardarse.
   */
  horasDelTerapeuta(): string[] {
    if (!this.hfTerapeutaId || !this.hfDiaSemana) return [];
    const bloques = this.horariosTerapeutas.filter(
      h => this.idDelHorario(h) === this.hfTerapeutaId && h.diaSemana === this.hfDiaSemana && h.activo);
    const horas = new Set<string>();
    for (const b of bloques) {
      for (let m = this.aMinutos(b.horaInicio); m < this.aMinutos(b.horaFin); m += 30) {
        horas.add(this.aTexto(m));
      }
    }
    return [...horas].sort();
  }

  alCambiarTerapeutaHF(): void { this.hfDiaSemana = null; this.hfHoraInicio = null; this.hfError = ''; }
  alCambiarDiaHF(): void { this.hfHoraInicio = null; this.hfError = ''; }

  agregarHorarioFijo(): void {
    if (!this.hfTerapeutaId || !this.hfDiaSemana || !this.hfHoraInicio) return;
    // El mismo terapeuta, dia y hora dos veces choca con el UNIQUE de la tabla; se avisa aqui
    // en vez de dejar que el guardado falle con un mensaje generico.
    const repetido = this.horariosFijos.some(h =>
      h.terapeutaId === this.hfTerapeutaId && h.diaSemana === this.hfDiaSemana && h.horaInicio === this.hfHoraInicio);
    if (repetido) {
      this.hfError = 'Ese horario ya está en la lista.';
      return;
    }
    this.horariosFijos.push({
      terapeutaId:   this.hfTerapeutaId,
      tipoTerapiaId: this.hfTipoTerapiaId,
      diaSemana:     this.hfDiaSemana,
      horaInicio:    this.hfHoraInicio,
      horaFin:       null,
    });
    this.horariosFijos.sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio));
    this.hfDiaSemana = null;
    this.hfHoraInicio = null;
    this.hfError = '';
  }

  quitarHorarioFijo(i: number): void {
    this.horariosFijos.splice(i, 1);
    this.hfError = '';
  }

  private limpiarHorarioFijo(): void {
    this.horariosFijos = [];
    this.hfTerapeutaId = null;
    this.hfTipoTerapiaId = null;
    this.hfDiaSemana = null;
    this.hfHoraInicio = null;
    this.hfError = '';
  }

  /** El horario puede venir con el terapeuta anidado o como id plano, segun el endpoint. */
  private idDelHorario(h: TerapeutaHorario): number | undefined {
    return h.terapeuta?.id ?? h.terapeutaId;
  }

  private aMinutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  private aTexto(minutos: number): string {
    const h = Math.floor(minutos / 60), m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    if (this.esMenorDeEdad && (!this.formData.dniApoderado.trim() || !this.formData.nombreApoderado.trim() || !this.formData.celularApoderado.trim())) {
      this.toast.warning('El paciente es menor de edad — completa el DNI, nombre y celular del apoderado.');
      return;
    }
    this.guardando = true;
    const body = this.buildBody();
    const esEdicion = !!this.editando;
    const op$ = esEdicion
      ? this.pacienteService.update(this.editando!.id!, body)
      : this.pacienteService.create(body);
    op$.subscribe({
      next: actualizado => {
        this.toast.success(esEdicion ? 'Paciente actualizado correctamente' : 'Paciente creado correctamente');
        // El horario fijo va en una segunda llamada: al crear todavía no existe el id contra el
        // cual colgarlo. Va después del toast de éxito a propósito — el paciente ya quedó
        // guardado, y si esto falla no se debe dar a entender lo contrario.
        this.guardarHorarioFijoDe(actualizado, esEdicion);
        this.cerrarModal();
        // Editar solo cambia campos de una fila ya visible: se actualiza en el array local, sin
        // volver a pedirle la página entera al back. Crear sí necesita recargar (posición según orden/filtro).
        if (esEdicion) {
          const idx = this.pacientes.findIndex(p => p.id === actualizado.id);
          if (idx !== -1) this.pacientes[idx] = actualizado;
        } else {
          this.cargar();
        }
        this.guardando = false;
      },
      // El back explica el motivo cuando lo sabe (DNI ya usado por otro paciente, apoderado
      // obligatorio en un menor...). Tragarse ese texto y mostrar siempre "Error al guardar"
      // dejaba a recepción adivinando qué campo corregir.
      error: (err) => { this.toast.error(err?.error?.error || 'Error al guardar el paciente'); this.guardando = false; }
    });
  }

  abrirEliminar(p: Paciente): void {
    if (!this.puedeEliminar) return;
    this.pacienteAEliminar = p;
    this.modalEliminar = true;
  }

  cerrarEliminar(): void { this.modalEliminar = false; this.pacienteAEliminar = null; }

  eliminar(): void {
    if (!this.pacienteAEliminar?.id) return;
    this.eliminando = true;
    const id = this.pacienteAEliminar.id;
    this.pacienteService.delete(id).subscribe({
      next: () => {
        this.toast.success('Paciente eliminado correctamente');
        this.cerrarEliminar(); this.eliminando = false;
        // Se quita la fila del array local en vez de repetir el GET paginado completo.
        this.pacientes = this.pacientes.filter(p => p.id !== id);
        this.totalElementos = Math.max(0, this.totalElementos - 1);
        // Si esa era la última fila de una página que no es la primera, retrocede una página.
        if (this.pacientes.length === 0 && this.paginaActual > 0) {
          this.paginaActual--; this.cargar();
        }
      },
      error: () => { this.toast.error('Error al eliminar el paciente'); this.eliminando = false; }
    });
  }

  iniciales(p: Paciente): string {
    return ((p.nombre?.[0] ?? '') + (p.apellido?.[0] ?? '')).toUpperCase();
  }

  private emptyForm(): PacienteForm {
    // Por defecto, la primera sede activa (típicamente Sede Principal) — el backend hace lo mismo
    // si de todos modos llega sin sede, esto solo evita que el admin vea "Sin sede" en el form.
    return { nombre: '', apellido: '', dni: '', telefono: '', correo: '',
             fechaNacimiento: '', dniApoderado: '', nombreApoderado: '', celularApoderado: '',
             notas: '', activo: true, sedeId: this.sedes[0]?.id ?? null, origenId: null };
  }

  private buildBody(): Partial<Paciente> {
    const f = this.formData;
    return {
      nombre:            f.nombre,
      apellido:          f.apellido,
      dni:               f.dni               || undefined,
      telefono:          f.telefono          || undefined,
      correo:            f.correo            || undefined,
      fechaNacimiento:   f.fechaNacimiento   || undefined,
      dniApoderado:      f.dniApoderado      || undefined,
      nombreApoderado:   f.nombreApoderado   || undefined,
      celularApoderado:  f.celularApoderado  || undefined,
      notas:             f.notas             || undefined,
      activo:            f.activo,
      origen:            f.origenId ? { id: f.origenId } as any : undefined,
      sede:              f.sedeId   ? { id: f.sedeId   } as any : undefined,
    };
  }
}
