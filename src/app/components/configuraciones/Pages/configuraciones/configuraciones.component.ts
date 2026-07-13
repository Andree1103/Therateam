import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CatalogItem } from '../../../../core/models/catalog.model';

type TabTipo = 'estandar' | 'estado' | 'moneda' | 'terapia';

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
  ];

  tabActivo: CatalogoTab = this.tabs[0];

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
  formEspecialidad   = '';
  formSesiones: number | null = null;
  formComentario     = '';

  areas: CatalogItem[] = [];
  filtroAreaTerapia: number | null = null;

  get esEstado()  { return this.tabActivo.tipo === 'estado'; }
  get esMoneda()  { return this.tabActivo.tipo === 'moneda'; }
  get esTerapia() { return this.tabActivo.tipo === 'terapia'; }
  get tieneKey()  { return this.tabActivo.tipo !== 'moneda'; }

  /** Items del tab activo, filtrados por área si estamos en "Tipos de terapia" y hay un filtro elegido. */
  get itemsFiltrados(): CatalogItem[] {
    if (!this.esTerapia || this.filtroAreaTerapia == null) return this.tabActivo.items;
    return this.tabActivo.items.filter(i => i.area?.id === this.filtroAreaTerapia);
  }

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.seleccionarTab(this.tabs[0]);
    this.api.get<CatalogItem[]>('/api/cat-areas').subscribe({
      next: d => this.areas = d,
      error: () => {}
    });
  }

  seleccionarTab(tab: CatalogoTab): void {
    this.filtroAreaTerapia = null;
    this.tabActivo = tab;
    if (!tab.cargado) this.cargarTab(tab);
  }

  cargarTab(tab: CatalogoTab): void {
    tab.loading = true;
    this.api.get<CatalogItem[]>(tab.path).subscribe({
      next: d => { tab.items = d; tab.loading = false; tab.cargado = true; },
      error: () => { tab.loading = false; tab.cargado = true; }
    });
  }

  abrirNuevo(): void {
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
    this.formEspecialidad = '';
    this.formSesiones  = null;
    this.formComentario = '';
    this.modalAbierto  = true;
  }

  abrirEditar(item: CatalogItem): void {
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
    this.formEspecialidad = item.especialidad || '';
    this.formSesiones     = item.sesionesSugeridas ?? null;
    this.formComentario   = item.comentario || '';
    this.modalAbierto     = true;
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

  abrirEliminar(item: CatalogItem): void { this.itemAEliminar = item; this.modalEliminar = true; }
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
      base['especialidad']      = this.formEspecialidad || null;
      base['sesionesSugeridas'] = this.formSesiones || null;
      base['comentario']        = this.formComentario || null;
    }
    return base;
  }

  private recargarTab(tab: CatalogoTab): void {
    tab.cargado = false;
    this.cargarTab(tab);
  }
}
