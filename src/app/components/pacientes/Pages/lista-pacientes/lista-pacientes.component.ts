import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { PacienteService } from '../../Services/paciente.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Paciente, PacienteForm } from '../../Models/paciente.model';
import { CatalogItem, Sede } from '../../../../core/models/catalog.model';

@Component({
  selector: 'app-lista-pacientes',
  templateUrl: './lista-pacientes.component.html',
  styleUrls: ['./lista-pacientes.component.css']
})
export class ListaPacientesComponent implements OnInit {

  pacientes: Paciente[] = [];
  filtrados: Paciente[] = [];
  loading = false;
  guardando = false;
  eliminando = false;

  busqueda = '';
  filtroActivo = '';

  modalAbierto = false;
  editando: Paciente | null = null;
  formData: PacienteForm = this.emptyForm();

  pacienteAEliminar: Paciente | null = null;
  modalEliminar = false;

  sedes: Sede[] = [];
  origenes: CatalogItem[] = [];
  cargandoCatalogos = true;

  get total() { return this.pacientes.length; }

  constructor(
    private pacienteService: PacienteService,
    private catalogService: CatalogService,
    private toast: ToastService
  ) {}

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
    this.pacienteService.getAll().subscribe({
      next: data => { this.pacientes = data; this.filtrar(); this.loading = false; },
      error: ()   => { this.loading = false; }
    });
  }

  filtrar(): void {
    const q = this.busqueda.toLowerCase().trim();
    this.filtrados = this.pacientes.filter(p => {
      const nombre = `${p.nombre} ${p.apellido}`.toLowerCase();
      const matchQ = !q || nombre.includes(q) ||
        (p.dni || '').toLowerCase().includes(q) ||
        (p.correo || '').toLowerCase().includes(q) ||
        (p.telefono || '').includes(q);
      const matchActivo = !this.filtroActivo || String(p.activo ?? true) === this.filtroActivo;
      return matchQ && matchActivo;
    });
  }

  abrirNuevo(): void {
    this.editando = null;
    this.formData = this.emptyForm();
    this.modalAbierto = true;
  }

  abrirEditar(p: Paciente): void {
    this.editando = p;
    this.formData = {
      nombre:          p.nombre,
      apellido:        p.apellido,
      dni:             p.dni             || '',
      telefono:        p.telefono        || '',
      correo:          p.correo          || '',
      fechaNacimiento: p.fechaNacimiento || '',
      notas:           p.notas           || '',
      activo:          p.activo          ?? true,
      sedeId:          p.sede?.id        ?? null,
      origenId:        p.origen?.id      ?? null,
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardando = true;
    const body = this.buildBody();
    const op$ = this.editando
      ? this.pacienteService.update(this.editando.id!, body)
      : this.pacienteService.create(body);
    op$.subscribe({
      next: () => {
        this.toast.success(this.editando ? 'Paciente actualizado correctamente' : 'Paciente creado correctamente');
        this.cerrarModal(); this.cargar(); this.guardando = false;
      },
      error: () => { this.toast.error('Error al guardar el paciente'); this.guardando = false; }
    });
  }

  abrirEliminar(p: Paciente): void {
    this.pacienteAEliminar = p;
    this.modalEliminar = true;
  }

  cerrarEliminar(): void { this.modalEliminar = false; this.pacienteAEliminar = null; }

  eliminar(): void {
    if (!this.pacienteAEliminar?.id) return;
    this.eliminando = true;
    this.pacienteService.delete(this.pacienteAEliminar.id).subscribe({
      next: () => {
        this.toast.success('Paciente eliminado correctamente');
        this.cerrarEliminar(); this.cargar(); this.eliminando = false;
      },
      error: () => { this.toast.error('Error al eliminar el paciente'); this.eliminando = false; }
    });
  }

  iniciales(p: Paciente): string {
    return ((p.nombre?.[0] ?? '') + (p.apellido?.[0] ?? '')).toUpperCase();
  }

  private emptyForm(): PacienteForm {
    return { nombre: '', apellido: '', dni: '', telefono: '', correo: '',
             fechaNacimiento: '', notas: '', activo: true, sedeId: null, origenId: null };
  }

  private buildBody(): Partial<Paciente> {
    const f = this.formData;
    return {
      nombre:          f.nombre,
      apellido:        f.apellido,
      dni:             f.dni             || undefined,
      telefono:        f.telefono        || undefined,
      correo:          f.correo          || undefined,
      fechaNacimiento: f.fechaNacimiento || undefined,
      notas:           f.notas           || undefined,
      activo:          f.activo,
      origen:          f.origenId ? { id: f.origenId } as any : undefined,
      sede:            f.sedeId   ? { id: f.sedeId   } as any : undefined,
    };
  }
}
