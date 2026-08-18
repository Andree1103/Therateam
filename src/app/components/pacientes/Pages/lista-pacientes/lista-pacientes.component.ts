import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { PacienteService, PacienteFiltros } from '../../Services/paciente.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ExcelExportService } from '../../../../core/services/excel-export.service';
import { Paciente, PacienteForm } from '../../Models/paciente.model';
import { CatalogItem, Sede } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';

@Component({
  selector: 'app-lista-pacientes',
  templateUrl: './lista-pacientes.component.html',
  styleUrls: ['./lista-pacientes.component.css']
})
export class ListaPacientesComponent implements OnInit {

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
    private excelExportService: ExcelExportService
  ) {}

  /** Exporta TODOS los pacientes que cumplen los filtros activos (no solo la página visible). */
  exportarExcel(): void {
    this.exportando = true;
    const filtros: PacienteFiltros = {
      nombre: this.filtroNombre,
      dni: this.filtroDni,
      correo: this.filtroCorreo,
      sedeId: this.filtroSedeId,
      activo: this.filtroActivo === '' ? null : this.filtroActivo === 'true',
    };
    this.pacienteService.getAllPaged(0, 10000, filtros).subscribe({
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
          'Usuario creación': p.usuarioCreacionNombre ?? '',
        }));
        this.excelExportService.exportar(filas, 'pacientes');
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
      error: () => { this.toast.error('Error al guardar el paciente'); this.guardando = false; }
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
