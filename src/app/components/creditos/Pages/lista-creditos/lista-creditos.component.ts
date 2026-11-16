import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CreditoService } from '../../../../core/services/credito.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../auth/Services/auth.service';
import { CatalogItem } from '../../../../core/models/catalog.model';
import {
  CobroCredito, CreditoAmarre, CreditoLinea, CuentaCredito, TipoCuentaCredito,
} from '../../../../core/models/credito.model';

interface UsuarioOpcion {
  id: number;
  nombre: string;
  apellido: string;
  email?: string;
  rol?: { id: number; key?: string; nombre?: string } | null;
}

interface PacienteOpcion {
  id: number;
  nombre: string;
  apellido: string;
  dni?: string;
}

/** Una línea con su casilla: el cobro parcial se elige marcando, no escribiendo ids. */
interface LineaElegible extends CreditoLinea {
  marcada: boolean;
}

@Component({
  selector: 'app-lista-creditos',
  templateUrl: './lista-creditos.component.html',
  styleUrls: ['./lista-creditos.component.css']
})
export class ListaCreditosComponent implements OnInit {

  /**
   * Fiar y cobrar son dos permisos distintos, y esta pantalla sirve a los dos.
   *
   * El cajero sin permiso para fiar entra, ve a quién hay que cobrarle y cobra; lo que no puede
   * es abrir cuentas ni amarrar pacientes. Si se le escondiera la pantalla entera no podría
   * cobrar nada, que es exactamente su trabajo.
   */
  get puedeFiar(): boolean { return this.auth.puedeDarCredito(); }
  get puedeCobrar(): boolean { return this.auth.puedeCrear('PAGOS'); }

  cuentas: CuentaCredito[] = [];
  loading = false;

  filtroTipo: TipoCuentaCredito | '' = '';
  soloConDeuda = false;

  // ── Panel de la cuenta ────────────────────────────────────────────────────
  abierta: CuentaCredito | null = null;
  lineas: LineaElegible[] = [];
  amarres: CreditoAmarre[] = [];
  cargandoPanel = false;
  verTodasLasLineas = false;

  // Amarrar un paciente mas a la cuenta
  buscaPaciente = '';
  resultadosPaciente: PacienteOpcion[] = [];
  buscandoPaciente = false;

  // ── Abrir / editar cuenta ─────────────────────────────────────────────────
  modalCuenta = false;
  editando: CuentaCredito | null = null;
  usuarios: UsuarioOpcion[] = [];
  formTitularId: number | null = null;
  formTipo: TipoCuentaCredito = 'TRABAJADOR';
  formLimite: number | null = null;
  formActivo = true;
  formNotas = '';
  guardandoCuenta = false;

  // ── Cobro ─────────────────────────────────────────────────────────────────
  modalCobro = false;
  metodosPago: CatalogItem[] = [];
  cobroMetodoId: number | null = null;
  /** Vacío = toda la deuda de lo marcado. Sirve para "te doy 200 a cuenta". */
  cobroMonto: number | null = null;
  cobroReferencia = '';
  cobroNotas = '';
  cobrando = false;
  resultadoCobro: CobroCredito | null = null;

  constructor(
    private creditos: CreditoService,
    private api: ApiService,
    private catalogos: CatalogService,
    private toast: ToastService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.catalogos.getMetodosPago().subscribe(m => {
      this.metodosPago = m.filter(x => x.activo !== false);
    });
  }

  cargar(): void {
    this.loading = true;
    this.creditos.listar(this.filtroTipo || null, this.soloConDeuda).subscribe({
      next: c => { this.cuentas = c; this.loading = false; },
      error: () => { this.toast.error('No se pudieron cargar las cuentas de crédito'); this.loading = false; }
    });
  }

  // ── Totales del encabezado ────────────────────────────────────────────────

  get deudaTotal(): number {
    return this.cuentas.reduce((s, c) => s + (c.deuda || 0), 0);
  }

  get cuentasConDeuda(): number {
    return this.cuentas.filter(c => (c.deuda || 0) > 0).length;
  }

  /** La atención sin cobrar más vieja de todas. Es el dato que dice si la cobranza se atrasó. */
  get masAntigua(): string | null {
    const fechas = this.cuentas.map(c => c.desde).filter((f): f is string => !!f).sort();
    return fechas.length ? fechas[0] : null;
  }

  nombreTipo(tipo?: string | null): string {
    if (tipo === 'TRABAJADOR') return 'Trabajador';
    if (tipo === 'PACIENTE')   return 'Paciente';
    if (tipo === 'CONVENIO')   return 'Convenio';
    return tipo || '—';
  }

  // ── Panel de la cuenta ────────────────────────────────────────────────────

  abrir(c: CuentaCredito): void {
    this.abierta = c;
    this.verTodasLasLineas = false;
    this.buscaPaciente = '';
    this.resultadosPaciente = [];
    this.cargarPanel();
  }

  cerrarPanel(): void {
    this.abierta = null;
    this.lineas = [];
    this.amarres = [];
  }

  private cargarPanel(): void {
    const id = this.abierta?.id;
    if (!id) return;
    this.cargandoPanel = true;
    this.creditos.lineas(id, !this.verTodasLasLineas).subscribe({
      next: l => {
        // Lo pendiente llega marcado: el cobro normal es "todo lo del mes", y desmarcar lo que
        // no se paga es menos trabajo que marcar lo que sí.
        this.lineas = l.map(x => ({ ...x, marcada: (x.deuda || 0) > 0 }));
        this.cargandoPanel = false;
      },
      error: () => { this.toast.error('No se pudieron cargar las atenciones de la cuenta'); this.cargandoPanel = false; }
    });
    this.creditos.amarres(id).subscribe({ next: a => this.amarres = a, error: () => {} });
  }

  alternarTodasLasLineas(): void {
    this.verTodasLasLineas = !this.verTodasLasLineas;
    this.cargarPanel();
  }

  get amarresActivos(): CreditoAmarre[] { return this.amarres.filter(a => a.activo !== false); }
  get amarresViejos(): CreditoAmarre[]  { return this.amarres.filter(a => a.activo === false); }

  // ── Amarrar pacientes ─────────────────────────────────────────────────────

  buscarPaciente(): void {
    const q = this.buscaPaciente.trim();
    if (q.length < 2) { this.resultadosPaciente = []; return; }
    this.buscandoPaciente = true;
    this.api.get<{ content: PacienteOpcion[] } | PacienteOpcion[]>(
      '/api/pacientes', { nombre: q, size: '8', activo: 'true' }
    ).subscribe({
      next: r => {
        const lista = Array.isArray(r) ? r : (r?.content ?? []);
        const ya = new Set(this.amarresActivos.map(a => a.pacienteId));
        this.resultadosPaciente = lista.filter(p => !ya.has(p.id));
        this.buscandoPaciente = false;
      },
      error: () => { this.resultadosPaciente = []; this.buscandoPaciente = false; }
    });
  }

  amarrar(p: PacienteOpcion): void {
    const id = this.abierta?.id;
    if (!id) return;
    this.creditos.amarrar(id, p.id).subscribe({
      next: () => {
        this.toast.success(`${p.nombre} ${p.apellido} queda cubierto por esta cuenta`);
        this.buscaPaciente = ''; this.resultadosPaciente = [];
        this.cargarPanel();
      },
      error: err => this.toast.error(err?.error?.error || 'No se pudo amarrar el paciente')
    });
  }

  desamarrar(a: CreditoAmarre): void {
    const id = this.abierta?.id;
    if (!id) return;
    this.creditos.desamarrar(id, a.pacienteId).subscribe({
      next: () => {
        this.toast.success(`${a.pacienteNombre} ya no se carga a esta cuenta`);
        this.cargarPanel();
      },
      error: err => this.toast.error(err?.error?.error || 'No se pudo quitar el paciente')
    });
  }

  // ── Abrir / editar cuenta ─────────────────────────────────────────────────

  abrirNueva(): void {
    this.editando = null;
    this.formTitularId = null;
    this.formTipo = 'TRABAJADOR';
    this.formLimite = null;
    this.formActivo = true;
    this.formNotas = '';
    this.modalCuenta = true;
    if (this.usuarios.length === 0) this.cargarUsuarios();
  }

  abrirEdicion(c: CuentaCredito): void {
    this.editando = c;
    this.formTitularId = c.titularUsuarioId;
    this.formTipo = c.tipo;
    this.formLimite = c.limite ?? null;
    this.formActivo = c.activo !== false;
    this.formNotas = c.notas || '';
    this.modalCuenta = true;
  }

  private cargarUsuarios(): void {
    // Un tamaño grande a propósito: es un desplegable, no un listado paginado, y la clínica
    // tiene decenas de usuarios, no miles.
    this.api.get<{ content: UsuarioOpcion[] }>('/api/usuarios', { size: '300', activo: 'true' })
      .subscribe({ next: r => this.usuarios = r?.content ?? [], error: () => {} });
  }

  get titularesDisponibles(): UsuarioOpcion[] {
    const conCuenta = new Set(this.cuentas.map(c => c.titularUsuarioId));
    return this.usuarios.filter(u => !conCuenta.has(u.id));
  }

  cerrarModalCuenta(): void { this.modalCuenta = false; }

  guardarCuenta(): void {
    if (!this.editando && !this.formTitularId) {
      this.toast.warning('Elige a quién se le fía'); return;
    }
    this.guardandoCuenta = true;
    const op$ = this.editando
      ? this.creditos.actualizar(this.editando.id, {
          tipo: this.formTipo, limite: this.formLimite,
          activo: this.formActivo, notas: this.formNotas.trim() || null,
        })
      : this.creditos.abrir(this.formTitularId!, this.formTipo,
                            this.formLimite, this.formNotas.trim() || null);
    op$.subscribe({
      next: () => {
        this.toast.success(this.editando ? 'Cuenta actualizada' : 'Cuenta de crédito abierta');
        this.modalCuenta = false;
        this.guardandoCuenta = false;
        const abiertaId = this.abierta?.id;
        this.cargar();
        if (abiertaId) this.refrescarAbierta(abiertaId);
      },
      error: err => {
        this.toast.error(err?.error?.error || 'No se pudo guardar la cuenta');
        this.guardandoCuenta = false;
      }
    });
  }

  // ── Cobro ─────────────────────────────────────────────────────────────────

  get lineasMarcadas(): LineaElegible[] {
    return this.lineas.filter(l => l.marcada && (l.deuda || 0) > 0);
  }

  get totalMarcado(): number {
    return this.lineasMarcadas.reduce((s, l) => s + (l.deuda || 0), 0);
  }

  marcarTodas(valor: boolean): void {
    for (const l of this.lineas) { if ((l.deuda || 0) > 0) l.marcada = valor; }
  }

  /** El método elegido, para poder decir antes de cobrar si el dinero entra a la caja o no. */
  get metodoElegido(): CatalogItem | undefined {
    return this.metodosPago.find(m => m.id === this.cobroMetodoId);
  }

  get cobroEntraACaja(): boolean {
    return this.metodoElegido?.cuentaEnCaja !== false;
  }

  abrirCobro(): void {
    if (this.lineasMarcadas.length === 0) {
      this.toast.warning('Marca al menos una atención para cobrar'); return;
    }
    this.cobroMetodoId = null;
    this.cobroMonto = null;
    this.cobroReferencia = '';
    this.cobroNotas = '';
    this.resultadoCobro = null;
    this.modalCobro = true;
  }

  cerrarCobro(): void { this.modalCobro = false; this.resultadoCobro = null; }

  get cobroPuedeGuardar(): boolean {
    if (this.cobrando || !this.cobroMetodoId) return false;
    if (this.cobroMonto != null && (this.cobroMonto <= 0 || this.cobroMonto > this.totalMarcado)) return false;
    return this.lineasMarcadas.length > 0;
  }

  cobrar(): void {
    const id = this.abierta?.id;
    if (!id || !this.cobroPuedeGuardar) return;
    this.cobrando = true;
    // Las líneas viajan siempre, aunque estén todas marcadas: así el cobro es exactamente lo
    // que se vio en pantalla y no "lo que estuviera pendiente al llegar la petición", que puede
    // haber cambiado si alguien agendó algo mientras se contaba el dinero.
    this.creditos.cobrar(id, {
      metodoId: this.cobroMetodoId,
      lineas: this.lineasMarcadas.map(l => ({ tipo: l.tipo, id: l.id })),
      monto: this.cobroMonto,
      referencia: this.cobroReferencia.trim() || null,
      notas: this.cobroNotas.trim() || null,
    }).subscribe({
      next: r => {
        this.resultadoCobro = r;
        this.cobrando = false;
        this.cargar();
        this.refrescarAbierta(id);
        this.cargarPanel();
      },
      error: err => {
        this.toast.error(err?.error?.error || 'No se pudo registrar el cobro');
        this.cobrando = false;
      }
    });
  }

  /** La deuda se recalcula en el servidor, así que después de cobrar se vuelve a pedir. */
  private refrescarAbierta(id: number): void {
    this.creditos.detalle(id).subscribe({ next: c => { if (this.abierta?.id === id) this.abierta = c; },
                                          error: () => {} });
  }
}
