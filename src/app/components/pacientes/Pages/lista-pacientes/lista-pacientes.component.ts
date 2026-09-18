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
import { HorarioFijo, HorarioFijoRequest, DIAS_SEMANA, DIAS_CORTOS, soloHoraYMinuto } from '../../Models/horario-fijo.model';

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
  // Rango de fecha de ALTA. Filtra la lista y, con ella, lo que se exporta.
  filtroCreadoDesde = '';
  filtroCreadoHasta = '';

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
  /**
   * Exporta lo que dicen los filtros de la lista, sin preguntar nada.
   *
   * El rango de fecha de alta vivía dentro de un modal de exportación: había que abrirlo para
   * elegirlo y no se podía VER en pantalla a los pacientes de ese rango, solo bajarlos. Ahora es
   * un filtro más de la barra, así que exportar es un clic y siempre coincide con la lista.
   *
   * Se piden de nuevo al servidor con los mismos filtros porque la pantalla muestra una página
   * de 10 y el excel tiene que traer todo lo que cumple, no solo lo que se ve.
   */
  exportarExcel(): void {
    if (this.rangoAltaInvalido) {
      this.toast.warning('La fecha inicial no puede ser posterior a la final');
      return;
    }
    this.exportando = true;
    this.pacienteService.getAllPaged(0, 10000, this.filtrosActuales()).subscribe({
      next: res => {
        this.exportando = false;
        if (res.content.length === 0) { this.toast.warning('No hay pacientes para exportar con los filtros actuales'); return; }
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
        const sufijo = this.filtroCreadoDesde || this.filtroCreadoHasta
          ? `_altas_${this.filtroCreadoDesde || 'inicio'}_a_${this.filtroCreadoHasta || 'hoy'}` : '';
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

  get rangoAltaInvalido(): boolean {
    return !!(this.filtroCreadoDesde && this.filtroCreadoHasta && this.filtroCreadoDesde > this.filtroCreadoHasta);
  }

  /** Un solo sitio donde se arman los filtros, para que la lista y el excel no puedan divergir. */
  private filtrosActuales(): PacienteFiltros {
    return {
      nombre: this.filtroNombre,
      dni: this.filtroDni,
      correo: this.filtroCorreo,
      sedeId: this.filtroSedeId,
      activo: this.filtroActivo === '' ? null : this.filtroActivo === 'true',
      creadoDesde: this.filtroCreadoDesde || null,
      creadoHasta: this.filtroCreadoHasta || null,
    };
  }

  cargar(): void {
    if (this.rangoAltaInvalido) {
      this.toast.warning('La fecha inicial no puede ser posterior a la final');
      return;
    }
    this.loading = true;
    this.pacienteService.getAllPaged(this.paginaActual, this.tamanioPagina, this.filtrosActuales()).subscribe({
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
    this.filtroCreadoDesde = '';
    this.filtroCreadoHasta = '';
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
  readonly DIAS_C = DIAS_CORTOS;

  terapeutas: Terapeuta[] = [];
  tiposTerapia: CatalogItem[] = [];
  /** Horario semanal de TODOS los terapeutas, de una sola peticion. */
  private horariosTerapeutas: TerapeutaHorario[] = [];

  horariosFijos: HorarioFijoRequest[] = [];
  hfTerapeutaId: number | null = null;
  hfTipoTerapiaId: number | null = null;
  /** Varios días a la vez: "Física los lunes, miércoles y viernes a las 10" es UN gesto, no tres. */
  hfDias: number[] = [];
  hfHoraInicio: string | null = null;
  hfError = '';

  // ── Los tres buscadores del alta ──────────────────────────────────────────
  // Desplegables normales obligaban a recorrer con el raton listas largas de terapeutas y
  // terapias. Estos filtran al escribir. El texto visible y el id elegido van por separado:
  // mientras se escribe el id queda en null, asi que "Agregar" no se habilita con algo a medias.
  hfDropdown: 'terapeuta' | 'terapia' | 'hora' | null = null;
  hfTerapeutaTexto = '';
  hfTerapiaTexto = '';
  hfHoraTexto = '';

  abrirHfDropdown(cual: 'terapeuta' | 'terapia' | 'hora'): void {
    // Al enfocar se vacia el texto para que la lista salga completa: si quedara el nombre ya
    // elegido, el filtro lo dejaria como unica opcion y no se podria cambiar sin borrar a mano.
    if (cual === 'terapeuta') { this.hfTerapeutaTexto = ''; this.hfTerapeutaId = null; this.alCambiarTerapeutaHF(); }
    if (cual === 'terapia')   { this.hfTerapiaTexto = ''; this.hfTipoTerapiaId = null; }
    if (cual === 'hora')      { this.hfHoraTexto = ''; this.hfHoraInicio = null; }
    this.hfDropdown = cual;
  }

  /** El blur llega antes que el mousedown de la opcion; sin la espera, el clic no alcanza. */
  cerrarHfDropdownDiferido(): void {
    setTimeout(() => {
      this.hfDropdown = null;
      // Si se salio sin elegir, el texto vuelve a lo que de verdad esta seleccionado, para que no
      // quede una busqueda a medias que parezca un valor puesto.
      this.hfTerapeutaTexto = this.hfTerapeutaId ? this.nombreTerapeuta(this.hfTerapeutaId) : '';
      this.hfTerapiaTexto   = this.hfTipoTerapiaId ? this.nombreTipoTerapia(this.hfTipoTerapiaId) : '';
      this.hfHoraTexto      = this.hfHoraInicio ?? '';
    }, 150);
  }

  private coincide(texto: string, filtro: string): boolean {
    return texto.toLowerCase().includes(filtro.trim().toLowerCase());
  }

  terapeutasFiltradosHF(): Terapeuta[] {
    return this.terapeutas.filter(t => this.coincide(this.nombreTerapeuta(t.id), this.hfTerapeutaTexto));
  }

  terapiasFiltradasHF(): CatalogItem[] {
    return this.tiposTerapia.filter(t => this.coincide(t.nombre ?? '', this.hfTerapiaTexto));
  }

  horasFiltradasHF(): string[] {
    return this.horasDelTerapeuta().filter(h => h.includes(this.hfHoraTexto.trim()));
  }

  elegirTerapeutaHF(t: Terapeuta): void {
    this.hfTerapeutaId = t.id ?? null;
    this.hfTerapeutaTexto = this.nombreTerapeuta(t.id);
    this.hfDropdown = null;
    this.alCambiarTerapeutaHF();
  }

  elegirTerapiaHF(tt: CatalogItem | null): void {
    this.hfTipoTerapiaId = tt?.id ?? null;
    this.hfTerapiaTexto = tt ? (tt.nombre ?? '') : '';
    this.hfDropdown = null;
    // La terapia define cada cuántos minutos se ofrecen las horas (Kids de 40 en 40, física
    // 30/45/50/60). Al cambiarla, la hora ya elegida puede dejar de caer en la cuadrícula: se
    // conserva solo si el terapeuta de verdad atiende a esa hora.
    if (this.hfHoraInicio && !this.horasDelTerapeuta().includes(this.hfHoraInicio)
        && this.horaLibreHF() !== this.hfHoraInicio) {
      this.hfHoraInicio = null;
      this.hfHoraTexto = '';
    }
  }

  elegirHoraHF(hora: string): void {
    this.hfHoraInicio = hora;
    this.hfHoraTexto = hora;
    this.hfDropdown = null;
    this.hfError = '';
  }

  /**
   * Lo ya agregado, agrupado por tipo de terapia.
   *
   * Es como se piensa el horario de un paciente: "Física lunes, miércoles y viernes; Psicología
   * los martes". En una lista plana esa estructura había que reconstruirla leyendo terapia por
   * terapia en cada chip.
   *
   * Se arrastra el índice original de cada línea porque quitarHorarioFijo() trabaja sobre el
   * array plano: sin él, borrar desde un grupo eliminaría la fila equivocada.
   */
  horariosAgrupados(): { tipoId: number | null; nombre: string; items: { h: HorarioFijoRequest; i: number }[] }[] {
    const grupos = new Map<number | null, { h: HorarioFijoRequest; i: number }[]>();
    this.horariosFijos.forEach((h, i) => {
      const clave = h.tipoTerapiaId ?? null;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push({ h, i });
    });
    return [...grupos.entries()]
      .map(([tipoId, items]) => ({
        tipoId,
        nombre: tipoId ? this.nombreTipoTerapia(tipoId) : 'Sin terapia definida',
        items: items.sort((a, b) => a.h.diaSemana - b.h.diaSemana || a.h.horaInicio.localeCompare(b.h.horaInicio)),
      }))
      // "Sin terapia definida" al final: es el caso incompleto, no encabeza la lista.
      .sort((a, b) => (a.tipoId === null ? 1 : b.tipoId === null ? -1 : a.nombre.localeCompare(b.nombre)));
  }

  /** Todo el grupo con el mismo terapeuta: entonces se nombra una vez y no en cada chip. */
  mismoTerapeutaEnGrupo(items: { h: HorarioFijoRequest; i: number }[]): boolean {
    return items.every(x => x.h.terapeutaId === items[0].h.terapeutaId);
  }

  toggleDiaHF(d: number): void {
    const i = this.hfDias.indexOf(d);
    if (i >= 0) this.hfDias.splice(i, 1);
    else this.hfDias.push(d);
    this.hfDias.sort((a, b) => a - b);
    // La hora se ofrece según el horario del terapeuta ese día; al cambiar los días puede dejar
    // de estar disponible, y dejarla puesta guardaría algo que el selector ya no muestra.
    if (this.hfHoraInicio && !this.horasDelTerapeuta().includes(this.hfHoraInicio)) {
      this.hfHoraInicio = null;
      this.hfHoraTexto = '';
    }
    this.hfError = '';
  }

  diaMarcadoHF(d: number): boolean { return this.hfDias.includes(d); }

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
  /**
   * Cada cuántos minutos se ofrecen las horas.
   *
   * Sale de la duración de la terapia elegida, no de un paso fijo: Kids va de 40 en 40 y física
   * tiene tipos de 30, 45, 50 o 60. Con el paso de 30 que había antes, un horario de Kids a las
   * 08:40 no aparecía en la lista y no había forma de anotarlo.
   *
   * Sin terapia elegida se usan 15 minutos: es el paso más fino, así que no deja fuera ninguna
   * hora razonable mientras todavía no se sabe de qué terapia se trata.
   */
  pasoHorasHF(): number {
    const tt = this.tiposTerapia.find(t => t.id === this.hfTipoTerapiaId) as any;
    const dur = tt?.duracionMinutos ?? tt?.duracion_minutos;
    return dur && dur > 0 ? dur : 15;
  }

  horasDelTerapeuta(): string[] {
    if (!this.hfTerapeutaId || this.hfDias.length === 0) return [];
    const paso = this.pasoHorasHF();
    // Con varios dias marcados solo se ofrecen las horas en que el terapeuta atiende TODOS ellos:
    // "lunes, miercoles y viernes a las 10" solo tiene sentido si los tres dias tienen esa hora.
    const porDia = this.hfDias.map(dia => {
      const horas = new Set<string>();
      for (const b of this.horariosTerapeutas.filter(
              h => this.idDelHorario(h) === this.hfTerapeutaId && h.diaSemana === dia && h.activo)) {
        for (let m = this.aMinutos(b.horaInicio); m < this.aMinutos(b.horaFin); m += paso) {
          horas.add(this.aTexto(m));
        }
      }
      return horas;
    });
    return [...porDia[0] ?? []].filter(h => porDia.every(set => set.has(h))).sort();
  }

  /**
   * Una hora escrita a mano que el terapeuta sí atiende pero que no cae en la cuadrícula.
   *
   * La cuadrícula es una ayuda, no un límite: si alguien viene a las 08:20 hay que poder
   * anotarlo. Se acepta cualquier HH:MM que quede dentro de la jornada del terapeuta en TODOS
   * los días marcados — fuera de eso sigue sin ofrecerse, que es la validación que importa.
   */
  horaLibreHF(): string | null {
    const txt = this.hfHoraTexto.trim();
    if (!/^\d{1,2}:\d{2}$/.test(txt)) return null;
    const [h, m] = txt.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    const normalizada = this.aTexto(h * 60 + m);
    if (this.horasDelTerapeuta().includes(normalizada)) return null;   // ya está en la lista
    if (!this.hfTerapeutaId || this.hfDias.length === 0) return null;
    const min = h * 60 + m;
    const atiendeTodosLosDias = this.hfDias.every(dia =>
      this.horariosTerapeutas.some(b => this.idDelHorario(b) === this.hfTerapeutaId && b.diaSemana === dia
        && b.activo && min >= this.aMinutos(b.horaInicio) && min < this.aMinutos(b.horaFin)));
    return atiendeTodosLosDias ? normalizada : null;
  }

  alCambiarTerapeutaHF(): void {
    this.hfDias = [];
    this.hfHoraInicio = null;
    this.hfHoraTexto = '';
    this.hfError = '';
  }

  /** Agrega una línea por cada día marcado — el caso normal es marcar lunes, miércoles y viernes. */
  agregarHorarioFijo(): void {
    if (!this.hfTerapeutaId || this.hfDias.length === 0 || !this.hfHoraInicio) return;

    // El mismo terapeuta, día y hora dos veces choca con el UNIQUE de la tabla; se avisa aquí en
    // vez de dejar que el guardado falle con un mensaje genérico.
    const yaEstaban = this.hfDias.filter(dia => this.horariosFijos.some(h =>
      h.terapeutaId === this.hfTerapeutaId && h.diaSemana === dia && h.horaInicio === this.hfHoraInicio));
    const nuevos = this.hfDias.filter(d => !yaEstaban.includes(d));

    if (nuevos.length === 0) {
      this.hfError = 'Esos horarios ya están en la lista.';
      return;
    }
    for (const dia of nuevos) {
      this.horariosFijos.push({
        terapeutaId:   this.hfTerapeutaId,
        tipoTerapiaId: this.hfTipoTerapiaId,
        diaSemana:     dia,
        horaInicio:    this.hfHoraInicio,
        horaFin:       null,
      });
    }
    this.horariosFijos.sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio));
    this.hfDias = [];
    this.hfHoraInicio = null;
    this.hfHoraTexto = '';
    // Si algunos dias se agregaron y otros ya estaban, se dice cual fue el caso en vez de
    // agregarlos en silencio y dejar al usuario contando filas.
    this.hfError = yaEstaban.length
      ? `${this.DIAS[yaEstaban[0]]}${yaEstaban.length > 1 ? ' y otros' : ''} ya estaba en la lista; se agregó el resto.`
      : '';
  }

  quitarHorarioFijo(i: number): void {
    this.horariosFijos.splice(i, 1);
    this.hfError = '';
  }

  private limpiarHorarioFijo(): void {
    this.horariosFijos = [];
    this.hfTerapeutaId = null;
    this.hfTipoTerapiaId = null;
    this.hfDias = [];
    this.hfHoraInicio = null;
    this.hfError = '';
    this.hfDropdown = null;
    this.hfTerapeutaTexto = '';
    this.hfTerapiaTexto = '';
    this.hfHoraTexto = '';
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
