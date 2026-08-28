import { Component, OnInit } from '@angular/core';
import { ProductoService } from '../../Services/producto.service';
import { Producto, VentaResumen } from '../../Models/producto.model';
import { AuthService } from '../../../auth/Services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

type Pestania = 'catalogo' | 'ventas';

@Component({
  selector: 'app-lista-productos',
  templateUrl: './lista-productos.component.html',
  styleUrls: ['./lista-productos.component.css']
})
export class ListaProductosComponent implements OnInit {

  pestania: Pestania = 'catalogo';

  productos: Producto[] = [];
  loading = false;
  busqueda = '';
  /** Los desactivados se ocultan por defecto: siguen existiendo solo por el historial de ventas. */
  mostrarInactivos = false;

  // ── Alta / edición ─────────────────────────────────────────────────────────
  mostrarForm = false;
  guardando = false;
  editandoId: number | null = null;
  form: Producto = this.formVacio();

  // ── Reposición de stock ────────────────────────────────────────────────────
  reponiendo: Producto | null = null;
  unidadesAReponer: number | null = null;

  // ── Reporte de ventas ──────────────────────────────────────────────────────
  ventas: VentaResumen[] = [];
  cargandoVentas = false;
  desde = '';
  hasta = '';

  constructor(
    private productoService: ProductoService,
    private authService: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargar();
    // Por defecto el reporte arranca en el mes en curso, que es lo que se suele querer ver.
    const hoy = new Date();
    this.desde = this.aInput(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    this.hasta = this.aInput(hoy);
  }

  get puedeCrear(): boolean { return this.authService.puedeCrear('PAGOS'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('PAGOS'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('PAGOS'); }

  get visibles(): Producto[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.productos
      .filter(p => this.mostrarInactivos || p.activo !== false)
      .filter(p => !q || p.nombre.toLowerCase().includes(q));
  }

  get valorInventario(): number {
    return this.visibles.reduce((acc, p) => acc + (p.precio ?? 0) * (p.stock ?? 0), 0);
  }

  /** Productos vigentes que ya no tienen unidades: no se pueden vender hasta reponer. */
  get sinStock(): Producto[] {
    return this.productos.filter(p => p.activo !== false && (p.stock ?? 0) <= 0);
  }

  cargar(): void {
    this.loading = true;
    this.productoService.getAll().subscribe({
      next: p => { this.productos = p; this.loading = false; },
      error: () => { this.loading = false; this.toast.error('Error al cargar los productos'); }
    });
  }

  // ── Alta / edición ─────────────────────────────────────────────────────────

  nuevo(): void {
    this.editandoId = null;
    this.form = this.formVacio();
    this.mostrarForm = true;
  }

  editar(p: Producto): void {
    this.editandoId = p.id ?? null;
    this.form = { ...p };
    this.mostrarForm = true;
  }

  cerrarForm(): void { this.mostrarForm = false; }

  guardar(): void {
    if (!this.form.nombre.trim()) { this.toast.warning('El nombre es obligatorio'); return; }
    if (this.form.precio == null || this.form.precio < 0) { this.toast.warning('Ingresa un precio válido'); return; }

    const body: Producto = {
      ...this.form,
      nombre: this.form.nombre.trim(),
      stock: this.form.stock ?? 0
    };

    this.guardando = true;
    const peticion = this.editandoId
      ? this.productoService.update(this.editandoId, body)
      : this.productoService.create(body);

    peticion.subscribe({
      next: () => {
        this.toast.success(this.editandoId ? 'Producto actualizado' : 'Producto creado');
        this.guardando = false;
        this.mostrarForm = false;
        this.cargar();
      },
      error: err => {
        this.guardando = false;
        this.toast.error(err?.error?.message || 'No se pudo guardar el producto');
      }
    });
  }

  // ── Stock ──────────────────────────────────────────────────────────────────

  abrirReponer(p: Producto): void {
    this.reponiendo = p;
    this.unidadesAReponer = null;
  }

  cerrarReponer(): void { this.reponiendo = null; }

  confirmarReponer(): void {
    if (!this.reponiendo?.id) return;
    if (!this.unidadesAReponer || this.unidadesAReponer <= 0) {
      this.toast.warning('Ingresa cuántas unidades ingresaron'); return;
    }
    this.productoService.reponer(this.reponiendo.id, this.unidadesAReponer).subscribe({
      next: () => {
        this.toast.success('Stock actualizado');
        this.reponiendo = null;
        this.cargar();
      },
      error: err => this.toast.error(err?.error?.message || 'No se pudo reponer el stock')
    });
  }

  desactivar(p: Producto): void {
    if (!p.id) return;
    if (!confirm(`¿Desactivar "${p.nombre}"? Dejará de aparecer al vender, pero las ventas ya registradas se conservan.`)) return;
    this.productoService.desactivar(p.id).subscribe({
      next: () => { this.toast.success('Producto desactivado'); this.cargar(); },
      error: () => this.toast.error('No se pudo desactivar el producto')
    });
  }

  reactivar(p: Producto): void {
    if (!p.id) return;
    this.productoService.update(p.id, { ...p, activo: true }).subscribe({
      next: () => { this.toast.success('Producto reactivado'); this.cargar(); },
      error: () => this.toast.error('No se pudo reactivar el producto')
    });
  }

  // ── Reporte ────────────────────────────────────────────────────────────────

  irAVentas(): void {
    this.pestania = 'ventas';
    if (this.ventas.length === 0) this.cargarVentas();
  }

  cargarVentas(): void {
    this.cargandoVentas = true;
    // El backend compara con < hasta, así que se manda el día siguiente a las 00:00 para
    // que el último día del rango entre completo.
    const hastaExclusivo = this.hasta ? this.aInput(this.sumarDias(new Date(this.hasta + 'T00:00:00'), 1)) : '';
    this.productoService.resumenVentas(
      this.desde ? `${this.desde}T00:00:00` : undefined,
      hastaExclusivo ? `${hastaExclusivo}T00:00:00` : undefined
    ).subscribe({
      next: v => { this.ventas = v; this.cargandoVentas = false; },
      error: () => { this.cargandoVentas = false; this.toast.error('Error al cargar las ventas'); }
    });
  }

  get totalVendido(): number { return this.ventas.reduce((a, v) => a + v.total, 0); }
  get unidadesVendidas(): number { return this.ventas.reduce((a, v) => a + v.unidades, 0); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private formVacio(): Producto {
    return { nombre: '', descripcion: '', precio: 0, stock: 0, activo: true };
  }

  private aInput(d: Date): string {
    const mes = `${d.getMonth() + 1}`.padStart(2, '0');
    const dia = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private sumarDias(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
}
