import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { AuthService } from '../../../auth/Services/auth.service';

type TabTipo = 'estandar' | 'estado' | 'moneda' | 'terapia' | 'paquete';

interface CatalogoTab {
  key: string;
  label: string;
  path: string;
  tipo: TabTipo;
  items: CatalogItem[];
  loading: boolean;
  cargado: boolean;
}

@Component({
  selector: 'app-configuraciones',
  templateUrl: './configuraciones.component.html',
  styleUrls: ['./configuraciones.component.css']
})
export class ConfiguracionesComponent implements OnInit {

  tabs: CatalogoTab[] = [
    { key: 'especialidades',       label: 'Especialidades',         path: '/api/cat-especialidades',       tipo: 'estandar', items: [], loading: false, cargado: false },
    { key: 'areas',                label: 'Áreas',                  path: '/api/cat-areas',                tipo: 'estandar', items: [], loading: false, cargado: false },
    { key: 'tipos-terapia',        label: 'Tipos de terapia',       path: '/api/tipos-terapia',            tipo: 'terapia',  items: [], loading: false, cargado: false },
    { key: 'origenes',             label: 'Orígenes de paciente',   path: '/api/cat-origenes',             tipo: 'estandar', items: [], loading: false, cargado: false },
    { key: 'metodos-pago',         label: 'Métodos de pago',        path: '/api/cat-metodos-pago',         tipo: 'estandar', items: [], loading: false, cargado: false },
    { key: 'modalidades',          label: 'Modalidades',            path: '/api/cat-modalidades',          tipo: 'estandar', items: [], loading: false, cargado: false },
    { key: 'monedas',              label: 'Monedas',                path: '/api/cat-monedas',              tipo: 'moneda',   items: [], loading: false, cargado: false },
    { key: 'estados-cita',         label: 'Estados de cita',        path: '/api/cat-estados-cita',         tipo: 'estado',   items: [], loading: false, cargado: false },
    { key: 'estados-sesion',       label: 'Estados de sesión',      path: '/api/cat-estados-sesion',       tipo: 'estado',   items: [], loading: false, cargado: false },
    { key: 'estados-tratamiento',  label: 'Estados de tratamiento', path: '/api/cat-estados-tratamiento',  tipo: 'estado',   items: [], loading: false, cargado: false },
    { key: 'paquetes',             label: 'Paquetes (catálogo)',    path: '/api/plantillas-paquete',       tipo: 'paquete',  items: [], loading: false, cargado: false },
  ];

  tabActivo: CatalogoTab = this.tabs[0];

  // ── Datos del negocio (nombre, teléfono, dirección) — solo editable, nunca se agregan filas ──
  mostrandoNegocio = false;
  cargandoNegocio = false;
  guardandoNegocio = false;
  negocio: { nombre_negocio: string; telefono: string; direccion: string } = {
    nombre_negocio: '', telefono: '', direccion: '',
  };

  modalAbierto  = false;
  editandoItem: CatalogItem | null = null;
  guardando  = false;
  eliminando = false;
  itemAEliminar: CatalogItem | null = null;
  modalEliminar = false;

  // Campos del formulario
  formNombre         = '';
  formKey            = '';
  formActivo         = true;
  formColorHex       = '#185FA5';
  formCodigo         = '';
  formSimbolo        = '';
  formDuracion       = 60;
  formMaxPacientes   = 1;
  formAreaId: number | null = null;
  formEspecialidadId: number | null = null;
  formSesiones: number | null = null;
  formComentario     = '';
  formPrecioRecomendado: number | null = null;
  // Plantillas de paquete
  formCategoria      = '';
  formTipoTerapiaId: number | null = null;
  formTotalSesiones: number | null = null;
  formPrecioTotal: number | null = null;

  areas: CatalogItem[] = [];
  especialidades: CatalogItem[] = [];
  tiposTerapia: CatalogItem[] = [];
  filtroAreaTerapia: number | null = null;

  get esEstado()  { return this.tabActivo.tipo === 'estado'; }
  get esMoneda()  { return this.tabActivo.tipo === 'moneda'; }
  get esTerapia() { return this.tabActivo.tipo === 'terapia'; }
  get esPaquete() { return this.tabActivo.tipo === 'paquete'; }
  get tieneKey()  { return this.tabActivo.tipo !== 'moneda' && this.tabActivo.tipo !== 'paquete'; }

  /** Items del tab activo, filtrados por área si estamos en "Tipos de terapia" y hay un filtro elegido. */
  get itemsFiltrados(): CatalogItem[] {
    if (!this.esTerapia || this.filtroAreaTerapia == null) return this.tabActivo.items;
    return this.tabActivo.items.filter(i => i.area?.id === this.filtroAreaTerapia);
  }

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private authService: AuthService,
    private catalogService: CatalogService,
  ) {}

  get puedeCrear(): boolean { return this.authService.puedeCrear('CONFIGURACIONES'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('CONFIGURACIONES'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('CONFIGURACIONES'); }

  ngOnInit(): void {
    this.mostrarNegocio();
    this.api.get<CatalogItem[]>('/api/cat-areas').subscribe({
      next: d => this.areas = d,
      error: () => {}
    });
    this.api.get<CatalogItem[]>('/api/cat-especialidades').subscribe({
      next: d => this.especialidades = d,
      error: () => {}
    });
    this.api.get<CatalogItem[]>('/api/tipos-terapia').subscribe({
      next: d => this.tiposTerapia = d,
      error: () => {}
    });
  }

  seleccionarTab(tab: CatalogoTab): void {
    this.mostrandoNegocio = false;
    this.filtroAreaTerapia = null;
    this.tabActivo = tab;
    if (!tab.cargado) this.cargarTab(tab);
  }

  mostrarNegocio(): void {
    this.mostrandoNegocio = true;
    this.cargarNegocio();
  }

  private cargarNegocio(): void {
    this.cargandoNegocio = true;
    this.api.get<Record<string, string>>('/api/configuracion/negocio').subscribe({
      next: d => {
        this.negocio = {
          nombre_negocio: d['nombre_negocio'] ?? '',
          telefono:       d['telefono']       ?? '',
          direccion:      d['direccion']      ?? '',
        };
        this.cargandoNegocio = false;
      },
      error: () => { this.cargandoNegocio = false; }
    });
  }

  guardarNegocio(): void {
    if (!this.puedeEditar) return;
    this.guardandoNegocio = true;
    this.api.put<Record<string, string>>('/api/configuracion/negocio', this.negocio).subscribe({
      next: () => { this.toast.success('Datos del negocio actualizados correctamente'); this.guardandoNegocio = false; },
      error: () => { this.toast.error('Error al guardar los datos del negocio'); this.guardandoNegocio = false; }
    });
  }

  cargarTab(tab: CatalogoTab): void {
    tab.loading = true;
    this.api.get<CatalogItem[]>(tab.path).subscribe({
      next: d => { tab.items = d; tab.loading = false; tab.cargado = true; },
      error: () => { tab.loading = false; tab.cargado = true; }
    });
  }

  abrirNuevo(): void {
    if (!this.puedeCrear) return;
    this.editandoItem  = null;
    this.formNombre    = '';
    this.formKey       = '';
    this.formActivo    = true;
    this.formColorHex  = '#185FA5';
    this.formCodigo    = '';
    this.formSimbolo   = '';
    this.formDuracion  = 60;
    this.formMaxPacientes = 1;
    this.formAreaId    = null;
    this.formEspecialidadId = null;
    this.formSesiones  = null;
    this.formComentario = '';
    this.formPrecioRecomendado = null;
    this.formCategoria = '';
    this.formTipoTerapiaId = null;
    this.formTotalSesiones = null;
    this.formPrecioTotal = null;
    this.modalAbierto  = true;
  }

  abrirEditar(item: CatalogItem): void {
    if (!this.puedeEditar) return;
    this.editandoItem     = item;
    this.formNombre       = item.nombre;
    this.formKey          = item.key      || '';
    this.formActivo       = item.activo   ?? true;
    this.formColorHex     = item.colorHex || '#185FA5';
    this.formCodigo       = item.codigo   || '';
    this.formSimbolo      = item.simbolo  || '';
    this.formDuracion     = item.duracionMinutos ?? 60;
    this.formMaxPacientes = item.maxPacientes    ?? 1;
    this.formAreaId       = item.area?.id ?? null;
    this.formEspecialidadId = item.especialidad?.id ?? null;
    this.formSesiones     = item.sesionesSugeridas ?? null;
    this.formComentario   = item.comentario || '';
    this.formPrecioRecomendado = item.precioRecomendado ?? null;
    this.formCategoria      = item.categoria || '';
    this.formTipoTerapiaId  = item.tipoTerapia?.id ?? null;
    this.formTotalSesiones  = item.totalSesiones ?? null;
    this.formPrecioTotal    = item.precioTotal ?? null;
    this.modalAbierto     = true;
  }

  /** Si el tipo de terapia elegido ya tiene área propia, la sugiere — sigue siendo editable a mano. */
  onTipoTerapiaPaqueteChange(): void {
    const tipo = this.tiposTerapia.find(t => t.id === this.formTipoTerapiaId);
    if (tipo?.area?.id) this.formAreaId = tipo.area.id;
  }

  cerrarModal(): void { this.modalAbierto = false; }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardando = true;
    const tab  = this.tabActivo;
    const body = this.buildBody();
    const esEdicion = !!this.editandoItem;
    const op$ = esEdicion
      ? this.api.put<CatalogItem>(`${tab.path}/${this.editandoItem!.id}`, body)
      : this.api.post<CatalogItem>(tab.path, body);
    op$.subscribe({
      next: () => {
        this.toast.success(esEdicion ? `${tab.label} actualizado correctamente` : `${tab.label} creado correctamente`);
        this.cerrarModal(); this.recargarTab(tab); this.guardando = false;
      },
      error: () => { this.toast.error(`Error al guardar en ${tab.label}`); this.guardando = false; }
    });
  }

  abrirEliminar(item: CatalogItem): void {
    if (!this.puedeEliminar) return;
    this.itemAEliminar = item; this.modalEliminar = true;
  }
  cerrarEliminar(): void { this.modalEliminar = false; this.itemAEliminar = null; }

  eliminar(): void {
    if (!this.itemAEliminar?.id) return;
    this.eliminando = true;
    const tab = this.tabActivo;
    this.api.delete<void>(`${tab.path}/${this.itemAEliminar.id}`).subscribe({
      next: () => {
        this.toast.success('Elemento eliminado correctamente');
        this.cerrarEliminar(); this.recargarTab(tab); this.eliminando = false;
      },
      error: () => { this.toast.error('Error al eliminar'); this.eliminando = false; }
    });
  }

  private buildBody(): Record<string, unknown> {
    const base: Record<string, unknown> = {
      nombre: this.formNombre,
      activo: this.formActivo,
    };
    if (this.tieneKey && this.formKey) base['key'] = this.formKey;

    if (this.esEstado) {
      base['colorHex'] = this.formColorHex;
    } else if (this.esMoneda) {
      base['codigo']  = this.formCodigo;
      base['simbolo'] = this.formSimbolo;
    } else if (this.esTerapia) {
      if (this.formKey) base['key'] = this.formKey;
      base['duracionMinutos']   = this.formDuracion;
      base['maxPacientes']      = this.formMaxPacientes;
      base['area']              = this.formAreaId ? { id: this.formAreaId } : null;
      base['especialidad']      = this.formEspecialidadId ? { id: this.formEspecialidadId } : null;
      base['sesionesSugeridas'] = this.formSesiones || null;
      base['comentario']        = this.formComentario || null;
      base['precioRecomendado'] = this.formPrecioRecomendado || null;
    } else if (this.esPaquete) {
      base['categoria']      = this.formCategoria || null;
      base['area']           = this.formAreaId ? { id: this.formAreaId } : null;
      base['especialidad']   = this.formEspecialidadId ? { id: this.formEspecialidadId } : null;
      base['tipoTerapia']    = this.formTipoTerapiaId ? { id: this.formTipoTerapiaId } : null;
      base['totalSesiones']  = this.formTotalSesiones;
      base['precioTotal']    = this.formPrecioTotal;
    }
    return base;
  }

  private recargarTab(tab: CatalogoTab): void {
    tab.cargado = false;
    this.cargarTab(tab);
    // El resto de la app puede tener este catálogo cacheado (CatalogService) — se invalida para
    // que el próximo que lo pida traiga la versión recién guardada, no la vieja en memoria.
    this.catalogService.invalidate(tab.path);
  }
}
