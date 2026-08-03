import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { PageResponse } from '../../../../core/models/page.model';

interface PermisoItem {
  modulo: { id: number; key: string; nombre: string };
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

interface RolItem {
  id: number;
  key: string;
  nombre: string;
  activo?: boolean;
  permisos: PermisoItem[];
}

interface AccionesModulo { crear: boolean; editar: boolean; eliminar: boolean; }

interface UsuarioItem {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  activo?: boolean;
  rol: { id: number; key: string; nombre: string } | null;
  citasSoloPropias?: boolean;
  citasPuedeCrear?: boolean;
  createdAt?: string;
}

type OrdenCampo = 'nombre' | 'email' | 'createdAt';

type Tab = 'roles' | 'usuarios';

@Component({
  selector: 'app-lista-seguridad',
  templateUrl: './lista-seguridad.component.html',
  styleUrls: ['./lista-seguridad.component.css']
})
export class ListaSeguridadComponent implements OnInit {

  tab: Tab = 'roles';

  roles: RolItem[] = [];
  usuarios: UsuarioItem[] = [];
  modulos: CatalogItem[] = [];
  loading = false;

  // ── Paginación + búsqueda de usuarios (server-side) ─────────────────────
  readonly tamanioPaginaOpciones = [5, 10, 15, 20];
  paginaActual = 0;       // 0-based, como lo espera Spring
  tamanioPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;
  filtroNombre = '';
  filtroCorreo = '';
  filtroRolId: number | null = null;
  filtroEstado = '';
  ordenCampo: OrdenCampo = 'nombre';
  ordenDir: 'asc' | 'desc' = 'asc';

  // ── Modal Rol ────────────────────────────────────────────────────────────
  modalRolAbierto = false;
  editandoRol: RolItem | null = null;
  guardandoRol = false;
  formRolNombre = '';
  formRolKey = '';
  formRolActivo = true;
  /** Módulos a los que el rol tiene acceso (ver/navegar) — presencia en el set = acceso. */
  formRolAccesoIds: Set<number> = new Set();
  /** Acciones de escritura por módulo, solo tienen efecto si el módulo está en formRolAccesoIds. */
  formRolPermisos: Record<number, AccionesModulo> = {};

  // ── Modal Usuario ────────────────────────────────────────────────────────
  modalUsuarioAbierto = false;
  editandoUsuario: UsuarioItem | null = null;
  guardandoUsuario = false;
  formUsuNombre = '';
  formUsuApellido = '';
  formUsuEmail = '';
  formUsuPassword = '';
  formUsuRolId: number | null = null;
  formUsuActivo = true;
  formUsuCitasSoloPropias = false;
  formUsuCitasPuedeCrear = true;

  // ── Eliminar ─────────────────────────────────────────────────────────────
  modalEliminar = false;
  eliminandoTipo: Tab | null = null;
  eliminandoId: number | null = null;
  eliminandoNombre = '';
  eliminando = false;

  constructor(
    private api: ApiService,
    private catalogService: CatalogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.catalogService.getModulos().subscribe(d => this.modulos = d);
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.api.get<RolItem[]>('/api/cat-roles').subscribe({
      next: d => { this.roles = d; this.cargarUsuarios(); },
      error: () => { this.loading = false; }
    });
  }

  private cargarRoles(): void {
    this.api.get<RolItem[]>('/api/cat-roles').subscribe(d => this.roles = d);
  }

  private cargarUsuarios(): void {
    this.api.get<PageResponse<UsuarioItem>>('/api/usuarios', {
      page: String(this.paginaActual),
      size: String(this.tamanioPagina),
      nombre: this.filtroNombre.trim() || undefined,
      correo: this.filtroCorreo.trim() || undefined,
      rolId: this.filtroRolId != null ? String(this.filtroRolId) : undefined,
      activo: this.filtroEstado || undefined,
      sort: `${this.ordenCampo},${this.ordenDir}`,
    }).subscribe({
      next: res => {
        this.usuarios = res.content;
        this.totalElementos = res.totalElements;
        this.totalPaginas = res.totalPages;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /** Los filtros solo se aplican al clic en "Buscar" (o Enter) — nunca mientras se tipea/selecciona. */
  buscarUsuarios(): void {
    this.paginaActual = 0;
    this.cargarUsuarios();
  }

  limpiarFiltrosUsuarios(): void {
    this.filtroNombre = '';
    this.filtroCorreo = '';
    this.filtroRolId = null;
    this.filtroEstado = '';
    this.buscarUsuarios();
  }

  /** Clic en un encabezado ordenable: si ya se ordena por ese campo, invierte la dirección. */
  ordenarPor(campo: OrdenCampo): void {
    if (this.ordenCampo === campo) {
      this.ordenDir = this.ordenDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenCampo = campo;
      this.ordenDir = campo === 'createdAt' ? 'desc' : 'asc';
    }
    this.paginaActual = 0;
    this.cargarUsuarios();
  }

  cambiarTamanioPagina(size: number): void {
    this.tamanioPagina = size;
    this.paginaActual = 0;
    this.cargarUsuarios();
  }

  irAPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas || p === this.paginaActual) return;
    this.paginaActual = p;
    this.cargarUsuarios();
  }

  cambiarTab(t: Tab): void { this.tab = t; }

  // ── Roles ────────────────────────────────────────────────────────────────

  abrirNuevoRol(): void {
    this.editandoRol = null;
    this.formRolNombre = '';
    this.formRolKey = '';
    this.formRolActivo = true;
    this.formRolAccesoIds = new Set();
    this.formRolPermisos = {};
    this.modalRolAbierto = true;
  }

  abrirEditarRol(r: RolItem): void {
    this.editandoRol = r;
    this.formRolNombre = r.nombre;
    this.formRolKey = r.key || '';
    this.formRolActivo = r.activo ?? true;
    this.formRolAccesoIds = new Set((r.permisos || []).map(p => p.modulo.id));
    this.formRolPermisos = {};
    for (const p of r.permisos || []) {
      this.formRolPermisos[p.modulo.id] = { crear: p.crear, editar: p.editar, eliminar: p.eliminar };
    }
    this.modalRolAbierto = true;
  }

  /** Da/quita acceso (ver) al módulo. Al quitarlo se descartan sus acciones de escritura. */
  toggleAccesoModulo(id: number): void {
    if (this.formRolAccesoIds.has(id)) {
      this.formRolAccesoIds.delete(id);
      delete this.formRolPermisos[id];
    } else {
      this.formRolAccesoIds.add(id);
      this.formRolPermisos[id] = { crear: false, editar: false, eliminar: false };
    }
  }

  /** Da acceso completo (ver + crear + editar + eliminar) de un toque — atajo común. */
  darAccesoCompleto(id: number): void {
    this.formRolAccesoIds.add(id);
    this.formRolPermisos[id] = { crear: true, editar: true, eliminar: true };
  }

  toggleAccionModulo(id: number, accion: keyof AccionesModulo): void {
    if (!this.formRolPermisos[id]) this.formRolPermisos[id] = { crear: false, editar: false, eliminar: false };
    this.formRolPermisos[id][accion] = !this.formRolPermisos[id][accion];
  }

  cerrarModalRol(): void { this.modalRolAbierto = false; }

  guardarRol(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardandoRol = true;
    const permisos = Array.from(this.formRolAccesoIds).map(id => ({
      modulo: { id },
      crear: !!this.formRolPermisos[id]?.crear,
      editar: !!this.formRolPermisos[id]?.editar,
      eliminar: !!this.formRolPermisos[id]?.eliminar,
    }));
    const body = {
      nombre: this.formRolNombre,
      key: this.formRolKey.toUpperCase(),
      activo: this.formRolActivo,
      permisos,
    };
    const esEdicion = !!this.editandoRol;
    const op$ = esEdicion
      ? this.api.put<RolItem>(`/api/cat-roles/${this.editandoRol!.id}`, body)
      : this.api.post<RolItem>('/api/cat-roles', body);
    op$.subscribe({
      next: actualizado => {
        this.toast.success(esEdicion ? 'Rol actualizado correctamente' : 'Rol creado correctamente');
        this.cerrarModalRol();
        if (esEdicion) {
          const idx = this.roles.findIndex(r => r.id === actualizado.id);
          if (idx !== -1) this.roles[idx] = actualizado;
        } else {
          this.cargarRoles();
        }
        this.guardandoRol = false;
      },
      error: () => { this.toast.error('Error al guardar el rol'); this.guardandoRol = false; }
    });
  }

  // ── Usuarios ─────────────────────────────────────────────────────────────

  abrirNuevoUsuario(): void {
    this.editandoUsuario = null;
    this.formUsuNombre = '';
    this.formUsuApellido = '';
    this.formUsuEmail = '';
    this.formUsuPassword = '';
    this.formUsuRolId = null;
    this.formUsuActivo = true;
    this.formUsuCitasSoloPropias = false;
    this.formUsuCitasPuedeCrear = true;
    this.modalUsuarioAbierto = true;
  }

  /** Al elegir el rol en "Nuevo usuario", precarga valores sensatos: un Terapeuta nace restringido
   * (solo sus citas, no crea) — el admin puede destildarlo si ese terapeuta en particular sí debe poder. */
  onRolChangeNuevoUsuario(): void {
    if (this.editandoUsuario) return;
    const rol = this.roles.find(r => r.id === this.formUsuRolId);
    const esTerapeuta = rol?.key === 'TERAPEUTA';
    this.formUsuCitasSoloPropias = esTerapeuta;
    this.formUsuCitasPuedeCrear = !esTerapeuta;
  }

  abrirEditarUsuario(u: UsuarioItem): void {
    this.editandoUsuario = u;
    this.formUsuNombre = u.nombre;
    this.formUsuApellido = u.apellido;
    this.formUsuEmail = u.email;
    this.formUsuPassword = '';
    this.formUsuRolId = u.rol?.id ?? null;
    this.formUsuActivo = u.activo ?? true;
    this.formUsuCitasSoloPropias = u.citasSoloPropias ?? false;
    this.formUsuCitasPuedeCrear = u.citasPuedeCrear ?? true;
    this.modalUsuarioAbierto = true;
  }

  cerrarModalUsuario(): void { this.modalUsuarioAbierto = false; }

  guardarUsuario(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    const esEdicion = !!this.editandoUsuario;
    if (!esEdicion && !this.formUsuPassword.trim()) {
      this.toast.warning('La contraseña es obligatoria para un usuario nuevo'); return;
    }
    this.guardandoUsuario = true;
    const body: Record<string, unknown> = {
      nombre: this.formUsuNombre,
      apellido: this.formUsuApellido,
      email: this.formUsuEmail,
      activo: this.formUsuActivo,
      rol: this.formUsuRolId ? { id: this.formUsuRolId } : null,
      citasSoloPropias: this.formUsuCitasSoloPropias,
      citasPuedeCrear: this.formUsuCitasPuedeCrear,
    };
    if (this.formUsuPassword.trim()) body['passwordHash'] = this.formUsuPassword.trim();

    const op$ = esEdicion
      ? this.api.put<UsuarioItem>(`/api/usuarios/${this.editandoUsuario!.id}`, body)
      : this.api.post<UsuarioItem>('/api/usuarios', body);
    op$.subscribe({
      next: actualizado => {
        this.toast.success(esEdicion ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
        this.cerrarModalUsuario();
        // Editar solo cambia una fila ya visible: se actualiza en el array local en vez de
        // repetir el GET paginado. Crear sí necesita recargar (posición según orden/filtro).
        if (esEdicion) {
          const idx = this.usuarios.findIndex(u => u.id === actualizado.id);
          if (idx !== -1) this.usuarios[idx] = actualizado;
        } else {
          this.cargarUsuarios();
        }
        this.guardandoUsuario = false;
      },
      error: () => { this.toast.error('Error al guardar el usuario'); this.guardandoUsuario = false; }
    });
  }

  // ── Eliminar (roles y usuarios) ─────────────────────────────────────────

  abrirEliminarRol(r: RolItem): void {
    this.eliminandoTipo = 'roles'; this.eliminandoId = r.id; this.eliminandoNombre = r.nombre;
    this.modalEliminar = true;
  }

  abrirEliminarUsuario(u: UsuarioItem): void {
    this.eliminandoTipo = 'usuarios'; this.eliminandoId = u.id; this.eliminandoNombre = `${u.nombre} ${u.apellido}`;
    this.modalEliminar = true;
  }

  cerrarEliminar(): void { this.modalEliminar = false; this.eliminandoTipo = null; this.eliminandoId = null; }

  confirmarEliminar(): void {
    if (!this.eliminandoTipo || !this.eliminandoId) return;
    this.eliminando = true;
    const tipo = this.eliminandoTipo;
    const id = this.eliminandoId;
    const path = tipo === 'roles' ? 'cat-roles' : 'usuarios';
    this.api.delete<void>(`/api/${path}/${id}`).subscribe({
      next: () => {
        this.toast.success('Eliminado correctamente');
        this.cerrarEliminar(); this.eliminando = false;
        // Se quita del array local en vez de repetir el GET completo.
        if (tipo === 'roles') {
          this.roles = this.roles.filter(r => r.id !== id);
        } else {
          this.usuarios = this.usuarios.filter(u => u.id !== id);
          this.totalElementos = Math.max(0, this.totalElementos - 1);
          if (this.usuarios.length === 0 && this.paginaActual > 0) {
            this.paginaActual--; this.cargarUsuarios();
          }
        }
      },
      error: () => { this.toast.error('Error al eliminar — puede estar en uso'); this.eliminando = false; }
    });
  }
}
