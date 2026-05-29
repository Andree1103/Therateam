import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { TerapeutaService } from '../../Services/terapeuta.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Terapeuta, TerapeutaForm, TerapeutaCompletoRequest,
  terapeutaNombre, UsuarioBasico
} from '../../Models/terapeuta.model';
import { CatalogItem, Sede } from '../../../../core/models/catalog.model';

@Component({
  selector: 'app-lista-terapeutas',
  templateUrl: './lista-terapeutas.component.html',
  styleUrls: ['./lista-terapeutas.component.css']
})
export class ListaTerapeutasComponent implements OnInit {

  terapeutas: Terapeuta[] = [];
  filtrados: Terapeuta[] = [];
  loading = false;
  guardando = false;
  eliminando = false;

  busqueda = '';
  filtroActivo = '';

  modalAbierto = false;
  editando: Terapeuta | null = null;
  formData: TerapeutaForm = this.emptyForm();

  terapeutaAEliminar: Terapeuta | null = null;
  modalEliminar = false;

  usuariosLibres: UsuarioBasico[] = [];
  cargandoUsuarios = false;
  sedes: Sede[] = [];
  tiposTerapeuta: CatalogItem[] = [];
  especialidades: CatalogItem[] = [];

  get total() { return this.terapeutas.length; }
  nombreCompleto = terapeutaNombre;

  constructor(
    private terapeutaService: TerapeutaService,
    private catalogService: CatalogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.catalogService.getSedes().subscribe(d => this.sedes = d);
    this.catalogService.getTiposTerapeuta().subscribe(d => this.tiposTerapeuta = d);
    this.catalogService.getEspecialidades().subscribe(d => this.especialidades = d);
  }

  cargar(): void {
    this.loading = true;
    this.terapeutaService.getAll().subscribe({
      next: data => {
        console.log('[Terapeutas]', data);
        this.terapeutas = data; this.filtrar(); this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  filtrar(): void {
    const q = this.busqueda.toLowerCase().trim();
    this.filtrados = this.terapeutas.filter(t => {
      const nombre = terapeutaNombre(t).toLowerCase();
      const matchQ = !q || nombre.includes(q) || (t.cmp || '').toLowerCase().includes(q);
      const matchActivo = !this.filtroActivo || String(t.activo ?? true) === this.filtroActivo;
      return matchQ && matchActivo;
    });
  }

  abrirNuevo(): void {
    this.editando = null;
    this.formData = this.emptyForm();
    this.cargandoUsuarios = true;
    this.terapeutaService.getUsuariosLibres().subscribe({
      next: d => { this.usuariosLibres = d; this.cargandoUsuarios = false; },
      error: () => { this.cargandoUsuarios = false; }
    });
    this.modalAbierto = true;
  }

  abrirEditar(t: Terapeuta): void {
    this.editando = t;
    this.formData = {
      modo: 'nuevo',
      usuarioId: t.usuario?.id ?? null,
      nombre: t.usuario?.nombre ?? '',
      apellido: t.usuario?.apellido ?? '',
      email: t.usuario?.email ?? '',
      password: '',
      sedeId: null,
      tipoTerapeutaId: t.tipoTerapeuta?.id ?? null,
      cmp: t.cmp || '',
      telefono: t.telefono || '',
      horarioDescripcion: t.horarioDescripcion || '',
      activo: t.activo ?? true,
      especialidadIds: (t.especialidades || []).map(e => e.id),
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardando = true;
    const body = this.buildCompletoBody();
    const op$ = this.editando
      ? this.terapeutaService.updateCompleto(this.editando.id!, body)
      : this.terapeutaService.createCompleto(body);
    op$.subscribe({
      next: () => {
        this.toast.success(this.editando ? 'Terapeuta actualizado correctamente' : 'Terapeuta creado correctamente');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => { this.toast.error('Error al guardar el terapeuta'); this.guardando = false; }
    });
  }

  toggleEspecialidad(id: number): void {
    const idx = this.formData.especialidadIds.indexOf(id);
    if (idx === -1) this.formData.especialidadIds.push(id);
    else this.formData.especialidadIds.splice(idx, 1);
  }

  tieneEspecialidad(id: number): boolean {
    return this.formData.especialidadIds.includes(id);
  }

  abrirEliminar(t: Terapeuta): void {
    this.terapeutaAEliminar = t;
    this.modalEliminar = true;
  }

  cerrarEliminar(): void { this.modalEliminar = false; this.terapeutaAEliminar = null; }

  eliminar(): void {
    if (!this.terapeutaAEliminar?.id) return;
    this.eliminando = true;
    this.terapeutaService.delete(this.terapeutaAEliminar.id).subscribe({
      next: () => {
        this.toast.success('Terapeuta eliminado correctamente');
        this.cerrarEliminar(); this.cargar(); this.eliminando = false;
      },
      error: () => { this.toast.error('Error al eliminar el terapeuta'); this.eliminando = false; }
    });
  }

  iniciales(t: Terapeuta): string {
    const n = terapeutaNombre(t);
    const parts = n.split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  usuarioNombre(u: UsuarioBasico): string {
    return `${u.nombre} ${u.apellido}`;
  }

  private emptyForm(): TerapeutaForm {
    return {
      modo: 'existente', usuarioId: null,
      nombre: '', apellido: '', email: '', password: '', sedeId: null,
      tipoTerapeutaId: null, cmp: '', telefono: '',
      horarioDescripcion: '', activo: true, especialidadIds: []
    };
  }

  private buildCompletoBody(): TerapeutaCompletoRequest {
    const f = this.formData;
    const modo: 'existente' | 'nuevo' = this.editando ? 'nuevo' : f.modo;
    const base: TerapeutaCompletoRequest = {
      modo,
      tipoTerapeutaId: f.tipoTerapeutaId || undefined,
      cmp:                f.cmp || undefined,
      telefono:           f.telefono || undefined,
      horarioDescripcion: f.horarioDescripcion || undefined,
      activo: f.activo,
      especialidadIds: f.especialidadIds,
      sedeId: f.sedeId || null,
    };
    if (modo === 'existente') {
      base.usuarioId = f.usuarioId!;
    } else {
      base.nombre   = f.nombre;
      base.apellido = f.apellido;
      base.email    = f.email;
      if (f.password) base.password = f.password;
    }
    return base;
  }
}
