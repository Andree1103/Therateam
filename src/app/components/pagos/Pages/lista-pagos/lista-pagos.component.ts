import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { PagoService } from '../../Services/pago.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { Pago, PagoForm, TratamientoBasico } from '../../Models/pago.model';
import { Paciente } from '../../../pacientes/Models/paciente.model';
import { CatalogItem } from '../../../../core/models/catalog.model';

@Component({
  selector: 'app-lista-pagos',
  templateUrl: './lista-pagos.component.html',
  styleUrls: ['./lista-pagos.component.css']
})
export class ListaPagosComponent implements OnInit {

  pagos: Pago[] = [];
  filtrados: Pago[] = [];
  loading = false;
  guardando = false;
  eliminando = false;
  cargandoTratamientos = false;

  busqueda = '';

  modalAbierto = false;
  formData: PagoForm = this.emptyForm();

  pagoAEliminar: Pago | null = null;
  modalEliminar = false;

  pacientes: Paciente[] = [];
  tratamientos: TratamientoBasico[] = [];
  metodosPago: CatalogItem[] = [];

  get total() { return this.pagos.length; }
  get totalMonto(): number {
    return this.filtrados.reduce((s, p) => s + (p.montoRecibido || 0), 0);
  }

  constructor(
    private pagoService: PagoService,
    private pacienteService: PacienteService,
    private catalogService: CatalogService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.pacienteService.getAll().subscribe(d => this.pacientes = d);
    this.catalogService.getMetodosPago().subscribe(d => this.metodosPago = d);
  }

  cargar(): void {
    this.loading = true;
    this.pagoService.getAll().subscribe({
      next: data => { this.pagos = data; this.filtrar(); this.loading = false; },
      error: ()   => { this.loading = false; }
    });
  }

  filtrar(): void {
    const q = this.busqueda.toLowerCase().trim();
    this.filtrados = this.pagos.filter(p => {
      const nombre = `${p.paciente?.nombre || ''} ${p.paciente?.apellido || ''}`.toLowerCase();
      return !q || nombre.includes(q) ||
        (p.referencia || '').toLowerCase().includes(q) ||
        (p.metodo?.nombre || '').toLowerCase().includes(q);
    });
  }

  abrirNuevo(): void {
    this.formData = this.emptyForm();
    this.tratamientos = [];
    this.modalAbierto = true;
  }

  cerrarModal(): void { this.modalAbierto = false; }

  onPacienteChange(): void {
    this.formData.tratamientoId = null;
    this.tratamientos = [];
    if (!this.formData.pacienteId) return;
    this.cargandoTratamientos = true;
    this.pagoService.getTratamientosByPaciente(this.formData.pacienteId).subscribe({
      next: data => { this.tratamientos = data; this.cargandoTratamientos = false; },
      error: ()   => { this.cargandoTratamientos = false; }
    });
  }

  guardar(form: NgForm): void {
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    this.guardando = true;
    const f = this.formData;
    const body: Partial<Pago> = {
      paciente:   f.pacienteId    ? { id: f.pacienteId }    as any : undefined,
      tratamiento: f.tratamientoId ? { id: f.tratamientoId } as any : undefined,
      metodo:     f.metodoId      ? { id: f.metodoId }      as any : undefined,
      montoRecibido: f.montoRecibido ?? undefined,
      referencia: f.referencia  || undefined,
      notas:      f.notas       || undefined,
      fechaPago:  f.fechaPago   || undefined,
    };
    this.pagoService.create(body).subscribe({
      next: () => { this.cerrarModal(); this.cargar(); this.guardando = false; },
      error: ()  => { this.guardando = false; }
    });
  }

  abrirEliminar(p: Pago): void {
    this.pagoAEliminar = p;
    this.modalEliminar = true;
  }

  cerrarEliminar(): void { this.modalEliminar = false; this.pagoAEliminar = null; }

  eliminar(): void {
    if (!this.pagoAEliminar?.id) return;
    this.eliminando = true;
    this.pagoService.delete(this.pagoAEliminar.id).subscribe({
      next: () => { this.cerrarEliminar(); this.cargar(); this.eliminando = false; },
      error: ()  => { this.eliminando = false; }
    });
  }

  pacienteNombre(p: Paciente): string {
    return `${p.nombre} ${p.apellido}`;
  }

  private emptyForm(): PagoForm {
    const hoy = new Date().toISOString().slice(0, 16);
    return { pacienteId: null, tratamientoId: null, metodoId: null,
             montoRecibido: null, referencia: '', notas: '', fechaPago: hoy };
  }
}
