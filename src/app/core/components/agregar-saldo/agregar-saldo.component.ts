import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PagoService } from '../../../components/pagos/Services/pago.service';
import { CitaService } from '../../../components/citas/Services/cita.service';
import { PacienteService } from '../../../components/pacientes/Services/paciente.service';
import { CatalogService } from '../../services/catalog.service';
import { ToastService } from '../../services/toast.service';
import { CatalogItem } from '../../models/catalog.model';
import { tieneDeuda } from '../../utils/estado-pago';

/**
 * Registrar un adelanto: dinero que el paciente deja a cuenta y queda como saldo a favor.
 *
 * POR QUÉ EXISTE: hasta ahora un saldo se creaba por OMISIÓN — en Pagos elegías al paciente y no
 * elegías ni cita ni paquete, y el importe entero caía a su favor. Nadie adivina eso, y tiene el
 * reverso peligroso: si querías cobrar una cita y olvidabas seleccionarla, el dinero se iba a
 * saldo en silencio. Esto le pone nombre y un botón a la operación.
 *
 * NO HACE NADA ESPECIAL POR DENTRO: crea un pago sin cita ni tratamiento, que es exactamente lo
 * que hacía la vía antigua. La regla del dinero sigue viviendo en PagoService, en un solo sitio.
 */
@Component({
  selector: 'app-agregar-saldo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agregar-saldo.component.html',
  styleUrls: ['./agregar-saldo.component.css'],
})
export class AgregarSaldoComponent {
  /** Con paciente fijado (ficha) no se busca; sin él (Adelantos) se muestra el buscador. */
  @Input() pacienteId: number | null = null;
  @Input() pacienteNombre = '';

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();
  /** El usuario prefiere cobrar la deuda en vez de dejar el dinero a favor. */
  @Output() irACobrar = new EventEmitter<number>();

  monto: number | null = null;
  metodoId: number | null = null;
  referencia = '';
  notas = '';
  guardando = false;

  metodosPago: CatalogItem[] = [];

  // Buscador de paciente (solo cuando no viene fijado).
  busqueda = '';
  resultados: { id: number; nombre: string; apellido: string; dni?: string }[] = [];
  buscando = false;
  seleccionadoId: number | null = null;
  seleccionadoNombre = '';

  // Lo que el paciente ya tiene y lo que debe — para no aparcar dinero de quien debía pagar algo.
  saldoActual = 0;
  deudaCitas = 0;
  deudaPaquetes = 0;
  cargandoDeuda = false;

  constructor(
    private pagoService: PagoService,
    private citaService: CitaService,
    private pacienteService: PacienteService,
    private catalogService: CatalogService,
    private toast: ToastService,
  ) {
    this.catalogService.getMetodosPago().subscribe({
      next: m => { this.metodosPago = m; this.metodoId = m[0]?.id ?? null; },
      error: () => {},
    });
  }

  ngOnInit(): void {
    if (this.pacienteId) {
      this.seleccionadoId = this.pacienteId;
      this.seleccionadoNombre = this.pacienteNombre;
      this.cargarEstadoDelPaciente(this.pacienteId);
    }
  }

  get deudaTotal(): number { return this.deudaCitas + this.deudaPaquetes; }

  get puedeGuardar(): boolean {
    return !this.guardando && !!this.seleccionadoId && !!this.metodoId && (this.monto ?? 0) > 0;
  }

  /** Yape/Plin necesitan el número de operación para poder rastrear el pago. */
  get requiereReferencia(): boolean {
    const n = this.metodosPago.find(m => m.id === this.metodoId)?.nombre?.toLowerCase() ?? '';
    return n.includes('yape') || n.includes('plin');
  }

  buscarPaciente(): void {
    const q = this.busqueda.trim();
    if (q.length < 2) { this.resultados = []; return; }
    this.buscando = true;
    this.citaService.buscarPorNombre(q).subscribe({
      next: (r: any) => { this.resultados = (r ?? []).slice(0, 8); this.buscando = false; },
      error: () => { this.resultados = []; this.buscando = false; },
    });
  }

  elegirPaciente(p: { id: number; nombre: string; apellido: string }): void {
    this.seleccionadoId = p.id;
    this.seleccionadoNombre = `${p.nombre} ${p.apellido}`.trim();
    this.resultados = [];
    this.busqueda = this.seleccionadoNombre;
    this.cargarEstadoDelPaciente(p.id);
  }

  /** Saldo actual y deuda pendiente, para decidir con la información delante. */
  private cargarEstadoDelPaciente(id: number): void {
    this.saldoActual = 0; this.deudaCitas = 0; this.deudaPaquetes = 0;
    this.cargandoDeuda = true;
    this.pacienteService.getById(id).subscribe({
      next: p => this.saldoActual = p.saldoAFavor ?? 0,
      error: () => {},
    });
    this.citaService.getByPaciente(id).subscribe({
      next: citas => {
        this.deudaCitas = citas
          .filter(c => !c.tratamiento_id && tieneDeuda(c.estado_pago_key) && (c.precio ?? 0) > 0)
          .reduce((t, c) => t + Math.max(0, (c.precio ?? 0) - (c.monto_pagado ?? 0)), 0);
        this.cargandoDeuda = false;
      },
      error: () => { this.cargandoDeuda = false; },
    });
    this.pagoService.getTratamientosByPaciente(id).subscribe({
      next: (ts: any[]) => {
        this.deudaPaquetes = (ts ?? []).reduce(
          (t, x) => t + Math.max(0, (x.montoTotal ?? 0) - (x.totalCobrado ?? 0)), 0);
      },
      error: () => {},
    });
  }

  guardar(): void {
    if (!this.puedeGuardar) {
      if (!this.seleccionadoId) this.toast.warning('Elige al paciente');
      else if (!(this.monto ?? 0)) this.toast.warning('Escribe el monto del adelanto');
      return;
    }
    if (this.requiereReferencia && !this.referencia.trim()) {
      this.toast.warning('Este método necesita el N° de operación'); return;
    }
    this.guardando = true;
    // Sin cita ni tratamiento: no hay deuda señalada que cubrir, así que el importe entero
    // queda a favor del paciente. Es la misma operación de siempre, ahora con nombre.
    this.pagoService.create({
      paciente:      { id: this.seleccionadoId } as any,
      metodo:        { id: this.metodoId } as any,
      montoRecibido: this.monto!,
      ...(this.referencia.trim() ? { referencia: this.referencia.trim() } : {}),
      notas:         this.notas.trim() || 'Adelanto a cuenta',
    } as any).subscribe({
      next: () => {
        this.toast.success(`Saldo a favor registrado: S/ ${(this.monto ?? 0).toFixed(2)}`);
        this.guardando = false;
        this.guardado.emit();
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error || 'No se pudo registrar el adelanto');
        this.guardando = false;
      },
    });
  }
}
