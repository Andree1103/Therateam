import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, toArray } from 'rxjs/operators';
import { TratamientoService } from '../../Services/tratamiento.service';
import { PagoService } from '../../../pagos/Services/pago.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AtencionClinicaService } from '../../../atencion-clinica/Services/atencion.service';
import { TratamientoDetalle, Sesion, tratamientoPaciente, tratamientoTerapeuta } from '../../Models/tratamiento.model';
import { AtencionClinica } from '../../../atencion-clinica/Models/atencion.model';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { ConfiguracionService } from '../../../../core/services/configuracion.service';
import { NotaAtencionPdfService } from '../../../../core/services/nota-atencion-pdf.service';
import { AuthService } from '../../../auth/Services/auth.service';
import { PacienteService } from '../../../pacientes/Services/paciente.service';
import { tieneDeuda } from '../../../../core/utils/estado-pago';

@Component({
  selector: 'app-detalle-tratamiento',
  templateUrl: './detalle-tratamiento.component.html',
  styleUrls: ['./detalle-tratamiento.component.css']
})
export class DetalleTratamientoComponent implements OnInit {

  loading = true;
  tratamiento: TratamientoDetalle | null = null;
  sesiones: Sesion[] = [];
  metodosPago: CatalogItem[] = [];

  modalPago = false;
  guardandoPago = false;

  citasSeleccionadas = new Set<number>();
  pagoMetodoId: number | null = null;
  pagoNotas = '';
  pagoReferencia = '';

  /** "citas": eliges sesiones puntuales, cada una cobra exactamente lo que le falta.
   *  "abono": ingresas un monto libre (ej. un adelanto de S/50 que no alcanza para ninguna
   *  sesión completa) y el backend lo reparte automáticamente entre las sesiones en orden. */
  modoPago: 'citas' | 'abono' = 'citas';
  abonoMonto: number | null = null;

  atencionMap = new Map<number, AtencionClinica | null>();
  sesionExpandida: number | null = null;

  pacienteNombre = tratamientoPaciente;
  terapeutaNombre = tratamientoTerapeuta;

  private tratamientoId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tratamientoService: TratamientoService,
    private pagoService: PagoService,
    private catalogService: CatalogService,
    private atencionService: AtencionClinicaService,
    private toast: ToastService,
    private configuracionService: ConfiguracionService,
    private notaAtencionPdfService: NotaAtencionPdfService,
    private authService: AuthService,
    private pacienteService: PacienteService
  ) {}

  /** Registrar un pago usa el permiso del módulo Pagos, igual que en Citas — el backend lo
   *  exige con MODULO_PAGOS_CREAR, así que sin esto el botón devolvía 403. */
  get puedeRegistrarPago(): boolean { return this.authService.puedeCrear('PAGOS'); }

  ngOnInit(): void {
    this.tratamientoId = Number(this.route.snapshot.paramMap.get('id'));
    this.catalogService.getMetodosPago().subscribe(d => this.metodosPago = d);
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    forkJoin({
      tratamiento: this.tratamientoService.getDetalle(this.tratamientoId),
      sesiones: this.tratamientoService.getSesiones(this.tratamientoId).pipe(
        catchError(() => of([] as Sesion[]))
      ),
    }).subscribe({
      next: ({ tratamiento, sesiones }) => {
        this.tratamiento = tratamiento;
        this.sesiones = [...sesiones].sort((a, b) => a.numero - b.numero);
        this.loading = false;
        this.cargarAtenciones();
        // El saldo solo se leia al abrir el modal de cobro. Como `cargar()` corre despues de
        // cada pago, releerlo aqui mantiene la cifra viva: antes, tras gastar parte del saldo,
        // la pantalla seguia ofreciendo el importe anterior.
        this.cargarSaldoDelPaciente();
      },
      error: () => {
        this.loading = false;
        this.toast.error('Error al cargar el tratamiento');
      }
    });
  }

  private cargarAtenciones(): void {
    const conCita = this.sesiones.filter(s => s.citaActiva?.id);
    if (conCita.length === 0) return;

    const requests$ = conCita.map(s =>
      this.atencionService.getByCita(s.citaActiva!.id).pipe(catchError(() => of(null)))
    );

    forkJoin(requests$).subscribe(results => {
      conCita.forEach((s, i) => {
        this.atencionMap.set(s.citaActiva!.id, results[i]);
      });
    });
  }

  toggleSesion(sesionId: number): void {
    this.sesionExpandida = this.sesionExpandida === sesionId ? null : sesionId;
  }

  getAtencion(citaId?: number): AtencionClinica | null {
    if (!citaId) return null;
    return this.atencionMap.get(citaId) ?? null;
  }

  // ── Sesiones para pagar ────────────────────────────────────────────────────

  get sesionesParaPagar(): Sesion[] {
    return this.sesiones.filter(s =>
      s.citaActiva && tieneDeuda(s.citaActiva.estadoPagoKey)
    );
  }

  /** Cuántas sesiones del paquete todavía no tienen cita creada — se completan desde
   *  Paquetes (editar), donde está el selector de horario recurrente. */
  get sesionesFaltantes(): number {
    return Math.max(0, (this.tratamiento?.totalSesiones ?? 0) - this.sesiones.length);
  }

  /** Lo que falta por pagar de una sesión puntual — el precio completo si no tiene nada pagado
   *  todavía, o solo el resto si ya quedó PARCIAL de un pago anterior (ej. el adelanto inicial). */
  saldoPendienteSesion(s: Sesion): number {
    const precio = s.citaActiva?.precio ?? this.tratamiento?.precioPorSesion ?? 0;
    const pagado = s.citaActiva?.montoPagado ?? 0;
    return Math.max(0, precio - pagado);
  }

  get totalPago(): number {
    return this.sesiones
      .filter(s => s.citaActiva && this.citasSeleccionadas.has(s.citaActiva.id))
      .reduce((sum, s) => sum + this.saldoPendienteSesion(s), 0);
  }

  get todasSeleccionadas(): boolean {
    const para = this.sesionesParaPagar;
    return para.length > 0 && this.citasSeleccionadas.size === para.length;
  }

  toggleCitaSeleccion(citaId: number): void {
    if (this.citasSeleccionadas.has(citaId)) {
      this.citasSeleccionadas.delete(citaId);
    } else {
      this.citasSeleccionadas.add(citaId);
    }
  }

  toggleTodasCitas(): void {
    if (this.todasSeleccionadas) {
      this.citasSeleccionadas.clear();
    } else {
      this.sesionesParaPagar.forEach(s => this.citasSeleccionadas.add(s.citaActiva!.id));
    }
  }

  // ── Cálculos financieros (leídos del paquete real — mismos campos que mantiene
  //    el motor de pagos: tratamiento.totalCobrado / saldoAFavor) ─────────────

  get totalCobradoReal(): number {
    return this.tratamiento?.totalCobrado ?? 0;
  }

  // ── Saldo a favor del paciente ────────────────────────────────────────────
  // El backend ya lo descuenta antes de pedir dinero nuevo (montoDisponible = recibido + saldo),
  // pero esta pantalla no lo mostraba: se le cobraba el paquete entero en efectivo a alguien que
  // ya tenia dinero adelantado, y su saldo se quedaba parado.
  pacienteSaldoAFavor = 0;
  saldoAAplicar: number | null = null;

  private cargarSaldoDelPaciente(): void {
    const id = this.tratamiento?.pacienteId ?? (this.tratamiento as any)?.paciente?.id;
    if (!id) { this.pacienteSaldoAFavor = 0; return; }
    // Ojo con poner la cifra a cero antes de pedirla: al abrir el cobro el bloque del saldo
    // desaparecia y el total saltaba al importe SIN saldo durante un instante, justo mientras
    // alguien lo esta leyendo para cobrar. Se deja la cifra anterior y se reemplaza al llegar.
    this.pacienteService.getById(id).subscribe({
      next: p => this.pacienteSaldoAFavor = p.saldoAFavor ?? 0,
      error: () => {}
    });
  }

  /** Si el saldo a favor se usa al cobrar las sesiones seleccionadas. */
  usarSaldoEnSesiones = true;

  /**
   * Cuantas de las sesiones marcadas paga el saldo entero, sin pedir dinero.
   *
   * Se cuentan sesiones completas: dejar una a medias con el saldo la deja PARCIAL y obliga a
   * perseguir el resto, que es peor que no usarlo.
   */
  get sesionesQueCubreElSaldo(): number {
    if (!this.usarSaldoEnSesiones || this.pacienteSaldoAFavor <= 0) return 0;
    let queda = this.pacienteSaldoAFavor;
    let n = 0;
    for (const s of this.sesiones) {
      if (!s.citaActiva || !this.citasSeleccionadas.has(s.citaActiva.id)) continue;
      const falta = this.saldoPendienteSesion(s);
      if (falta <= 0 || queda < falta) break;
      queda -= falta; n++;
    }
    return n;
  }

  /**
   * Lo que el paciente paga del saldo, y lo que entrega de verdad.
   *
   * El recuadro de arriba decia "A pagar ahora S/ 150" con el saldo marcado, cuando por caja
   * entraban 50. La cifra que se ensena tiene que ser la que se le pide a la persona que esta
   * en el mostrador; si no, el recibo y la pantalla cuentan cosas distintas.
   */
  get saldoAplicadoALasSesiones(): number {
    let queda = this.usarSaldoEnSesiones ? this.pacienteSaldoAFavor : 0;
    let usado = 0;
    for (const s of this.sesiones) {
      if (!s.citaActiva || !this.citasSeleccionadas.has(s.citaActiva.id)) continue;
      const falta = this.saldoPendienteSesion(s);
      if (falta <= 0 || queda < falta) break;
      queda -= falta; usado += falta;
    }
    return usado;
  }

  /**
   * Si hace falta elegir metodo de pago.
   *
   * Cuando el saldo cubre TODAS las sesiones marcadas no entra un sol, asi que no hay medio que
   * registrar. El campo seguia saliendo en rojo con "Selecciona el metodo" aunque el boton de
   * guardar estuviera habilitado: la pantalla pedia algo que ella misma no necesitaba.
   */
  get haceFaltaMetodo(): boolean {
    if (this.modoPago === 'abono') return true;
    return this.citasSeleccionadas.size > this.sesionesQueCubreElSaldo;
  }

  /** El dinero que hay que cobrar: lo seleccionado menos lo que cubre el saldo. */
  get efectivoDeLasSesiones(): number {
    return Math.max(0, this.totalPago - this.saldoAplicadoALasSesiones);
  }

  /** Lo que se pretende cobrar ahora: el abono escrito, o la deuda si aun no se escribio nada. */
  get cargoDelAbono(): number {
    const escrito = Number(this.abonoMonto) || 0;
    return escrito > 0 ? escrito : this.deuda;
  }

  get saldoMaximoAplicable(): number {
    return Math.min(this.pacienteSaldoAFavor, this.cargoDelAbono);
  }

  get saldoAplicadoEfectivo(): number {
    const pedido = this.saldoAAplicar == null ? this.saldoMaximoAplicable : Number(this.saldoAAplicar) || 0;
    return Math.max(0, Math.min(pedido, this.saldoMaximoAplicable));
  }

  /** El metodo elegido para lo que no cubre el saldo. El boton decia "en efectivo" a pelo. */
  get nombreMetodoDelCobro(): string {
    return this.metodosPago.find(m => m.id === this.pagoMetodoId)?.nombre ?? '';
  }

  get efectivoTrasSaldo(): number {
    return Math.max(0, this.cargoDelAbono - this.saldoAplicadoEfectivo);
  }

  /**
   * Cobra el paquete usando el saldo: se manda solo el efectivo que falta y el backend completa
   * con lo que el paciente tenia a favor.
   */
  /**
   * Abona al paquete usando SOLO el saldo a favor.
   *
   * No se pide metodo: no entra dinero nuevo. Antes se mandaba como "recibido" lo que el saldo
   * no alcanzaba a cubrir, y el backend lo contaba como dinero recien entregado — el paquete
   * quedaba saldado sin que entrara un sol, y al revertirlo devolvia al saldo mas de lo que
   * habia. Lo que falte se cobra aparte, con su medio.
   */
  /*
   * La fecha del pago la pone el servidor, no esta pantalla.
   *
   * Aqui se mandaba `new Date().toISOString()`, que es UTC. El campo del backend es hora local
   * (hora de pared, la del mostrador), asi que la Z se perdia y un pago de las 08:00 se guardaba
   * como las 13:00: caia en el turno TARDE y el reporte del turno manana no cuadraba con la caja.
   * Con la validacion de fecha no futura puesta esta semana, ademas, pasaba a fallar del todo —
   * cinco horas por delante. Sin el campo, @PrePersist sella la hora del servidor, que es la
   * buena y no depende del reloj de quien este cobrando.
   */
  pagarAbonoConSaldo(): void {
    if (this.saldoAplicadoEfectivo <= 0) return;
    const pacienteId = this.tratamiento!.pacienteId ?? (this.tratamiento as any)?.paciente?.id;
    this.guardandoPago = true;
    this.pagoService.create({
      tratamiento:   { id: this.tratamiento!.id },
      paciente:      pacienteId ? { id: pacienteId } : undefined,
      montoRecibido: 0,
      // Lo que dice la nota y lo que se gasta tienen que ser el mismo numero. Antes la nota
      // prometia "se usaron S/ X" y el motor gastaba todo el saldo que cupiera en la deuda.
      saldoAAplicar: this.saldoAplicadoEfectivo,
      notas:         this.efectivoTrasSaldo > 0
                       ? `Se usaron S/ ${this.saldoAplicadoEfectivo.toFixed(2)} de su saldo a favor`
                         + ` — quedan S/ ${this.efectivoTrasSaldo.toFixed(2)} por cobrar`
                       : 'Cobrado con su saldo a favor',
    } as any).subscribe({
      next: () => {
        this.toast.success('Pago registrado con su saldo a favor');
        this.cerrarPago();
        this.cargar();
        this.guardandoPago = false;
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error || 'No se pudo registrar el pago');
        this.guardandoPago = false;
      }
    });
  }

  get deuda(): number {
    const montoTotal = this.tratamiento?.montoTotal ?? 0;
    const cobrado = this.tratamiento?.totalCobrado ?? 0;
    return Math.max(0, montoTotal - cobrado);
  }

  get progreso(): number {
    const total     = this.tratamiento?.totalSesiones    ?? 0;
    const atendidas = this.tratamiento?.sesionesAtendidas ?? 0;
    return total > 0 ? Math.round((atendidas / total) * 100) : 0;
  }

  get estadoColor(): string {
    return this.tratamiento?.estadoColor ?? '#94a3b8';
  }

  // ── Formato de fechas ──────────────────────────────────────────────────────

  formatFecha(f?: string): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatFechaCorta(f?: string): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Modal Pago ────────────────────────────────────────────────────────────

  abrirPago(): void {
    this.citasSeleccionadas.clear();
    // Pre-seleccionar todas las citas pendientes de pago
    this.sesionesParaPagar.forEach(s => this.citasSeleccionadas.add(s.citaActiva!.id));
    this.pagoMetodoId   = null;
    this.pagoNotas      = '';
    this.pagoReferencia = '';
    this.modoPago       = 'citas';
    this.abonoMonto     = null;
    this.saldoAAplicar  = null;
    this.cargarSaldoDelPaciente();
    this.modalPago      = true;
  }

  cerrarPago(): void {
    this.modalPago = false;
    this.citasSeleccionadas.clear();
    this.pagoMetodoId   = null;
    this.pagoNotas      = '';
    this.pagoReferencia = '';
    this.modoPago       = 'citas';
    this.abonoMonto     = null;
  }

  guardarPago(): void {
    // Solo se exige el medio si de verdad entra dinero. Este guardia era incondicional: con el
    // saldo cubriendo todas las sesiones marcadas, el boton se habilitaba y al pulsarlo el
    // propio metodo se negaba a guardar pidiendo un dato que sobraba. El cobro con saldo no
    // llegaba a registrarse nunca desde esta pantalla.
    if (this.haceFaltaMetodo && !this.pagoMetodoId) {
      this.toast.warning('Selecciona el método de pago'); return;
    }
    const pacienteId  = this.tratamiento!.pacienteId
                     ?? (this.tratamiento as any)?.paciente?.id;

    if (this.modoPago === 'abono') {
      if (!this.abonoMonto || this.abonoMonto <= 0) {
        this.toast.warning('Ingresa un monto de abono válido'); return;
      }
      this.guardandoPago = true;
      // Sin `cita`: el backend reparte este monto solo entre las sesiones del paquete, en
      // orden, completando la que ya tenía algo pagado y dejando la siguiente en PARCIAL si
      // no alcanza para una sesión entera — igual que el adelanto inicial.
      this.pagoService.create({
        tratamiento:   { id: this.tratamiento!.id },
        paciente:      pacienteId ? { id: pacienteId } : undefined,
        metodo:        { id: this.pagoMetodoId },
        montoRecibido: this.abonoMonto,
        // Un abono en efectivo no es excusa para gastarle el saldo: si lo quiere usar, hay
        // boton aparte para eso.
        saldoAAplicar: 0,
        referencia:    this.pagoReferencia || undefined,
        notas:         this.pagoNotas      || undefined,
      } as any).subscribe({
        next: () => {
          this.toast.success('Abono registrado correctamente');
          this.cerrarPago();
          this.cargar();
          this.guardandoPago = false;
        },
        error: () => {
          this.toast.error('Error al registrar el abono');
          this.guardandoPago = false;
        }
      });
      return;
    }

    if (this.citasSeleccionadas.size === 0) {
      this.toast.warning('Selecciona al menos una cita para pagar'); return;
    }
    this.guardandoPago = true;
    // Cada cita cobra solo lo que le falta — si ya quedó PARCIAL de un pago anterior (ej. el
    // adelanto inicial), no se vuelve a cobrar el precio completo, solo el resto pendiente.
    const sesionesSeleccionadas = this.sesiones.filter(s => s.citaActiva && this.citasSeleccionadas.has(s.citaActiva.id));
    // Se registran UNO POR UNO (no en paralelo): cada pago recalcula el totalCobrado del paquete
    // leyendo el valor actual — si se mandan varios a la vez, dos pueden leer el mismo total antes
    // de que el anterior confirme, y uno se pisa con el otro (se pierde el aporte del primero).
    // El saldo a favor paga las primeras sesiones de la seleccion, sin pedir dinero nuevo.
    // Faltaba aqui: el motor descuenta el saldo solo si no llega el efectivo, asi que mandando
    // el importe completo de cada sesion el saldo se quedaba parado y se le cobraba todo otra
    // vez al paciente. Se descuenta en orden hasta que se acaba; a partir de ahi, efectivo.
    let saldoPorGastar = this.usarSaldoEnSesiones ? this.pacienteSaldoAFavor : 0;

    from(sesionesSeleccionadas).pipe(
      concatMap(s => {
        const falta = this.saldoPendienteSesion(s);
        const conSaldo = saldoPorGastar >= falta && falta > 0;
        if (conSaldo) saldoPorGastar -= falta;
        return this.pagoService.create({
        tratamiento:   { id: this.tratamiento!.id },
        paciente:      pacienteId ? { id: pacienteId } : undefined,
        cita:          { id: s.citaActiva!.id },
        ...(conSaldo ? {} : { metodo: { id: this.pagoMetodoId } }),
        montoRecibido: conSaldo ? 0 : falta,
        saldoAAplicar: conSaldo ? falta : 0,
        referencia:    this.pagoReferencia || undefined,
        notas:         this.pagoNotas      || undefined,
        } as any);
      }),
      toArray()
    ).subscribe({
      next: () => {
        const n = this.citasSeleccionadas.size;
        this.toast.success(`${n} pago${n > 1 ? 's' : ''} registrado${n > 1 ? 's' : ''} correctamente`);
        this.cerrarPago();
        this.cargar();
        this.guardandoPago = false;
      },
      error: () => {
        this.toast.error('Error al registrar el pago');
        this.guardandoPago = false;
      }
    });
  }

  // ── Cronograma (PDF para enviar por WhatsApp) ────────────────────────────

  descargarCronograma(): void {
    if (!this.tratamiento) return;
    forkJoin({
      tipos: this.catalogService.getTiposTerapia(),
      valores: this.configuracionService.getValores(),
    }).subscribe(({ tipos, valores }) => {
      const tipo = tipos.find(t => t.key === this.tratamiento!.tipoTerapiaKey);
      const areaNombre = tipo?.area?.nombre ?? this.tratamiento!.tipoTerapiaNombre ?? '';
      this.notaAtencionPdfService.descargarCronograma({
        dni: this.tratamiento!.pacienteDni ?? '',
        paciente: `${this.tratamiento!.pacienteNombre ?? ''} ${this.tratamiento!.pacienteApellido ?? ''}`.trim(),
        terapeuta: this.tratamiento!.terapeutaNombre ?? '',
        areaNombre,
        paqueteNombre: this.tratamiento!.notas || this.tratamiento!.nombre || '',
        sesiones: this.sesiones.map(s => ({
          numero: s.numero,
          fecha: s.citaActiva?.fechaInicio ? new Date(s.citaActiva.fechaInicio) : null,
          areaNombre,
          estado: s.citaActiva?.estado?.nombre ?? s.estado?.nombre ?? '',
        })),
      }, {
        nombreNegocio: valores['nombre_negocio'] || 'Thera Team',
        direccion: valores['direccion'] || '',
        telefono: valores['telefono'] || '',
      });
    });
  }

  // ── Anular paquete (todas las citas pendientes, no las ya atendidas) ──────

  mostrarAnularPaquete = false;
  anulandoPaquete = false;

  abrirAnularPaquete(): void { this.mostrarAnularPaquete = true; }
  cancelarAnularPaquete(): void { this.mostrarAnularPaquete = false; }

  confirmarAnularPaquete(devolucion: 'SALDO' | 'DINERO'): void {
    if (!this.tratamiento?.id) return;
    const msg = devolucion === 'SALDO'
      ? '¿Anular todas las citas pendientes de este paquete? Lo ya pagado por ellas quedará como saldo a favor del paciente. Las sesiones ya atendidas no se tocan.'
      : '¿Anular todas las citas pendientes y devolver el dinero? Se registra la devolución de cada sesión cancelada, sin generar saldo a favor. Las sesiones ya atendidas no se tocan.';
    if (!confirm(msg)) return;
    this.anulandoPaquete = true;
    this.tratamientoService.anularPaquete(this.tratamiento.id, devolucion).subscribe({
      next: () => {
        this.toast.success('Citas pendientes del paquete anuladas correctamente');
        this.anulandoPaquete = false;
        this.mostrarAnularPaquete = false;
        this.cargar();
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Error al anular el paquete');
        this.anulandoPaquete = false;
      }
    });
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  volver(): void { this.router.navigate(['/tratamientos']); }

  irCitas(): void { this.router.navigate(['/citas']); }

}
