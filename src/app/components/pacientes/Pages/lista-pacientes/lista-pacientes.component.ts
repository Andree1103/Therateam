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
import { forkJoin, of } from 'rxjs';
import { TerapeutaService } from '../../../terapeutas/Services/terapeuta.service';
import { TerapeutaHorarioService } from '../../../terapeutas/Services/terapeuta-horario.service';
import { Terapeuta } from '../../../terapeutas/Models/terapeuta.model';
import { TerapeutaHorario } from '../../../terapeutas/Models/terapeuta-horario.model';
import { HorarioFijo, HorarioFijoRequest, HorarioFijoResumen, DIAS_SEMANA, DIAS_CORTOS,
         soloHoraYMinuto, resumirHorarioFijo, duracionHorarioFijo } from '../../Models/horario-fijo.model';
import { horaAmPm, fechaHoraAmPm } from '../../../../core/utils/formato-hora';

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

  /**
   * Los pacientes que dicen los filtros de la lista, con su horario fijo, sin preguntar nada.
   *
   * El rango de fecha de alta vivía dentro de un modal de exportación: había que abrirlo para
   * elegirlo y no se podía VER en pantalla a los pacientes de ese rango, solo bajarlos. Ahora es
   * un filtro más de la barra, así que exportar es un clic y siempre coincide con la lista.
   */
  exportarExcel(): void {
    this.exportar('pacientes');
  }

  /**
   * Solo el cuadro de horarios fijos, sin los datos de los pacientes.
   *
   * Es el mismo dato que ya viaja como hoja del export de pacientes, pero suelto: cuando lo
   * que se quiere es repartir el cuadro semanal, abrir un archivo con las direcciones y los
   * apoderados de todos para llegar a la segunda hoja estorba más de lo que ayuda.
   */
  exportarHorariosFijos(): void {
    this.exportar('horarios_fijos');
  }

  /**
   * Un solo camino para las dos exportaciones: cambian las hojas, no de dónde salen los datos.
   *
   * Los horarios se piden en UNA llamada al listado general y se cruzan en memoria con los
   * pacientes exportados; pedirlos por paciente serían cien peticiones para cien pacientes.
   */
  private exportar(que: 'pacientes' | 'horarios_fijos'): void {
    if (this.rangoAltaInvalido) {
      this.toast.warning('La fecha inicial no puede ser posterior a la final');
      return;
    }
    this.exportando = true;
    forkJoin({
      pagina:   this.pacienteService.getAllPaged(0, 10000, this.filtrosActuales()),
      // El null distingue "falló la consulta" de "nadie tiene horario": tragarse el error y
      // devolver [] hacía decir "ningún paciente tiene horario fijo" cuando en realidad el
      // servidor no había respondido — un mensaje que manda a revisar los datos, que estan bien.
      horarios: this.pacienteService.getHorariosFijosDeTodos(this.filtrosActuales()).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ pagina, horarios }) => {
        this.exportando = false;
        const pacientes = pagina.content;
        if (pacientes.length === 0) { this.toast.warning('No hay pacientes para exportar con los filtros actuales'); return; }

        if (horarios === null) {
          this.toast.error('No se pudieron cargar los horarios fijos. Si el servidor se acaba de actualizar, reinícialo e intenta de nuevo.');
          if (que === 'horarios_fijos') return;
        }

        // Los horarios ya vienen acotados por los mismos filtros, pero se cruzan igual con los
        // pacientes exportados: es una consulta aparte y una fila colada sería una línea del
        // Excel que no corresponde a nadie de la lista.
        const exportados = new Set(pacientes.map(p => p.id));
        const suyos = (horarios ?? []).filter(h => exportados.has(h.pacienteId));

        if (que === 'horarios_fijos' && suyos.length === 0) {
          this.toast.warning('Ningún paciente de la lista tiene horario fijo cargado');
          return;
        }

        const filasHorario = suyos
          .slice()
          .sort((a, b) => a.paciente.localeCompare(b.paciente) || a.diaSemana - b.diaSemana
                       || a.horaInicio.localeCompare(b.horaInicio))
          .map(h => ({
            'Paciente': h.paciente,
            'DNI': h.dni ?? '',
            'Sede': h.sede ?? '',
            'Día': DIAS_SEMANA[h.diaSemana],
            'Hora inicio': horaAmPm(h.horaInicio),
            'Hora fin': h.horaFin ? horaAmPm(h.horaFin) : '',
            'Duración (min)': duracionHorarioFijo(h) ?? '',
            'Terapeuta': h.terapeuta ?? '',
            'Terapia': h.tipoTerapia ?? '',
            'Notas': h.notas ?? '',
          }));

        if (que === 'horarios_fijos') {
          this.excelExportService.exportarLibro(
            [{ nombre: 'Horarios fijos', filas: filasHorario }], `horarios_fijos${this.sufijoArchivo()}`);
          return;
        }

        // Resumen en la propia fila del paciente además de la hoja de detalle: quien abre el
        // export para revisar pacientes quiere ver ahí mismo si vienen fijo, sin saltar de hoja.
        const porPaciente = new Map<number, HorarioFijoResumen[]>();
        for (const h of suyos) {
          const lista = porPaciente.get(h.pacienteId) ?? [];
          lista.push(h);
          porPaciente.set(h.pacienteId, lista);
        }

        const filas = pacientes.map(p => ({
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
          'Horario fijo': (porPaciente.get(p.id!) ?? [])
            .slice()
            .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
            .map(resumirHorarioFijo).join(' | '),
          'Notas': p.notas ?? '',
          'Fecha de alta': p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-PE') : '',
          'Usuario creación': p.usuarioCreacionNombre ?? '',
        }));

        this.excelExportService.exportarLibro([
          { nombre: 'Pacientes', filas },
          { nombre: 'Horarios fijos', filas: filasHorario },
        ], `pacientes${this.sufijoArchivo()}`);
      },
      error: () => { this.exportando = false; this.toast.error('Error al exportar'); }
    });
  }

  /** Deja dicho en el nombre del archivo el rango de altas, cuando se filtró por él. */
  private sufijoArchivo(): string {
    return this.filtroCreadoDesde || this.filtroCreadoHasta
      ? `_altas_${this.filtroCreadoDesde || 'inicio'}_a_${this.filtroCreadoHasta || 'hoy'}` : '';
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
  /**
   * Cuánto dura la sesión de ESE horario. Arranca en la duración de la terapia, que es el caso
   * normal, pero se puede cambiar: el mismo paciente puede venir a una sesión más corta o más
   * larga de lo que dice el catálogo, y antes no había forma de anotarlo.
   */
  hfDuracion: number | null = null;
  readonly DURACIONES_HF = [20, 30, 40, 45, 50, 60, 80, 90, 120];
  hfError = '';

  /** Hora de fin que se guarda: la de inicio más la duración elegida. */
  horaFinHF(): string | null {
    if (!this.hfHoraInicio || !this.hfDuracion) return null;
    return this.aTexto(this.aMinutos(this.hfHoraInicio) + this.hfDuracion);
  }

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
    // La duración del catálogo es el punto de partida; queda editable.
    this.hfDuracion = this.pasoHorasHF();
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

  /** Minutos que dura una línea ya agregada, para mostrarlos en su chip. */
  duracionDe(h: HorarioFijoRequest): number | null {
    if (!h.horaFin) return null;
    return this.aMinutos(h.horaFin) - this.aMinutos(h.horaInicio);
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

  /**
   * Los siete dias, siempre.
   *
   * Antes solo salian los que el terapeuta tiene cargados en su horario, y eso dejaba fuera
   * sabado y domingo en cuanto su jornada no los incluia — aunque el paciente si venga. El
   * horario fijo es una anotacion de referencia: no reserva nada, asi que limitarlo al horario
   * configurado impedia anotar la realidad. Los dias que el terapeuta no tiene cargados se
   * marcan aparte (ver diaSinJornada) pero se pueden elegir igual.
   */
  diasDelTerapeuta(): number[] {
    return [1, 2, 3, 4, 5, 6, 7];
  }

  /** El terapeuta no tiene jornada cargada ese dia: se puede elegir, pero se avisa. */
  diaSinJornada(d: number): boolean {
    if (!this.hfTerapeutaId) return false;
    return !this.horariosTerapeutas.some(
      h => this.idDelHorario(h) === this.hfTerapeutaId && h.diaSemana === d && h.activo);
  }

  /** "lunes, martes y sábado" — para decirlo en una frase y no como lista de códigos. */
  nombresDias(dias: number[]): string {
    const n = dias.map(d => this.DIAS[d].toLowerCase());
    return n.length <= 1 ? (n[0] ?? '')
         : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1];
  }

  /** Los dias marcados que caen fuera de la jornada del terapeuta. */
  diasMarcadosSinJornada(): number[] {
    return this.hfDias.filter(d => this.diaSinJornada(d));
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
    // Si alguno de los dias marcados no tiene jornada cargada, no hay franjas que cruzar: se
    // ofrece la rejilla de la jornada habitual de la clinica para que igual se pueda anotar.
    if (this.hfDias.some(d => this.diaSinJornada(d))) {
      const horas: string[] = [];
      for (let m = 7 * 60; m < 21 * 60; m += paso) horas.push(this.aTexto(m));
      return horas;
    }
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
    // En un dia sin jornada cargada no hay contra que validar: se acepta cualquier hora, que es
    // lo coherente con poder anotar sabados y domingos aunque no esten configurados.
    const cabeEseDia = (dia: number) => this.diaSinJornada(dia) ||
      this.horariosTerapeutas.some(b => this.idDelHorario(b) === this.hfTerapeutaId && b.diaSemana === dia
        && b.activo && min >= this.aMinutos(b.horaInicio) && min < this.aMinutos(b.horaFin));
    return this.hfDias.every(cabeEseDia) ? normalizada : null;
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
        horaFin:       this.horaFinHF(),
      });
    }
    this.horariosFijos.sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio));
    this.hfDias = [];
    this.hfHoraInicio = null;
    this.hfHoraTexto = '';
    // La duración NO se limpia: al agregar varias líneas seguidas casi siempre se repite, y
    // volver a elegirla cada vez es trabajo de más.
    // Si algunos dias se agregaron y otros ya estaban, se dice cual fue el caso en vez de
    // agregarlos en silencio y dejar al usuario contando filas.
    this.hfError = yaEstaban.length
      ? `${this.DIAS[yaEstaban[0]]}${yaEstaban.length > 1 ? ' y otros' : ''} ya estaba en la lista; se agregó el resto.`
      : '';
  }

  /** La fila de alta está completa y lista para agregarse. */
  get hfFilaCompleta(): boolean {
    return !!this.hfTerapeutaId && this.hfDias.length > 0 && !!this.hfHoraInicio;
  }

  /** Se empezó a llenar la fila pero le falta algo para poder agregarla. */
  get hfFilaAMedias(): boolean {
    return !this.hfFilaCompleta && (!!this.hfTerapeutaId || this.hfDias.length > 0 || !!this.hfHoraInicio);
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
    this.hfDuracion = null;
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
    // Una fila de horario fijo completa pero sin pulsar "+" se perdía en silencio al guardar:
    // el usuario la ve llena en pantalla y da por hecho que se guarda con el paciente. Se agrega
    // sola, que es lo que evidentemente se quería.
    // Una fila a medias no se avisa con un toast: saltaba por solo haber abierto el selector de
    // terapeuta, encima del "Paciente actualizado", y no habia nada que el usuario tuviera que
    // hacer. La pista bajo la fila ya dice lo que falta mientras se esta llenando.
    if (this.hfFilaCompleta) this.agregarHorarioFijo();
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
