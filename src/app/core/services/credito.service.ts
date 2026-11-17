import { Injectable } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import {
  CobroCredito, CobroCreditoRequest, CreditoAmarre, CreditoLinea,
  CuentaCredito, TipoCuentaCredito,
} from '../models/credito.model';

/**
 * Las cuentas de crédito.
 *
 * Vive en core y no en el módulo de Créditos porque lo usan tres pantallas distintas: Créditos
 * (abrir cuentas y cobrar), Citas (ofrecer "a crédito" al agendar) y Paquetes (lo mismo al
 * crear el paquete). Fiar se ofrece donde se atiende, no en una pantalla aparte a la que haya
 * que ir con el paciente esperando — esa fricción es justamente la que hacía que se registrara
 * un efectivo que nadie entregó.
 */
@Injectable({ providedIn: 'root' })
export class CreditoService {

  private readonly PATH = '/api/creditos';

  constructor(private api: ApiService) {}

  /** El reporte de cobranza, ordenado por deuda. `tipo` separa trabajadores de pacientes. */
  listar(tipo?: TipoCuentaCredito | null, soloConDeuda = false): Observable<CuentaCredito[]> {
    return this.api.get<CuentaCredito[]>(this.PATH, {
      tipo: tipo || undefined,
      soloConDeuda: soloConDeuda ? 'true' : undefined,
    });
  }

  detalle(id: number): Observable<CuentaCredito> {
    return this.api.get<CuentaCredito>(`${this.PATH}/${id}`);
  }

  /** Lo pendiente, de lo más viejo a lo más nuevo — el orden en que se cobra. */
  lineas(id: number, soloPendientes = true): Observable<CreditoLinea[]> {
    return this.api.get<CreditoLinea[]>(`${this.PATH}/${id}/lineas`, {
      soloPendientes: soloPendientes ? 'true' : 'false',
    });
  }

  amarres(id: number): Observable<CreditoAmarre[]> {
    return this.api.get<CreditoAmarre[]>(`${this.PATH}/${id}/pacientes`);
  }

  /**
   * A qué cuenta se le puede cargar este paciente, si tiene alguna.
   *
   * Responde 204 sin cuerpo cuando no tiene ninguna, que con HttpClient llega como null — de ahí
   * que el tipo admita null sin que sea un error. El catchError cubre lo otro: un 403 del cajero
   * que no puede fiar no tiene que romper el formulario de citas, solo no ofrecer la opción.
   */
  /**
   * Todas las cuentas que pueden pagar por este paciente, la sugerida primero.
   *
   * Un paciente puede estar en varias: a la misma madre la paga su hija una semana y su hijo la
   * siguiente. El formulario las pone arriba del desplegable, antes del resto de cuentas.
   */
  cuentasDePaciente(pacienteId: number): Observable<CuentaCredito[]> {
    return this.api.get<CuentaCredito[]>(`${this.PATH}/paciente/${pacienteId}/cuentas`).pipe(
      catchError(() => of([] as CuentaCredito[]))
    );
  }

  cuentaDePaciente(pacienteId: number): Observable<CuentaCredito | null> {
    return this.api.get<CuentaCredito | null>(`${this.PATH}/paciente/${pacienteId}`).pipe(
      catchError(() => of(null))
    );
  }

  abrir(titularUsuarioId: number, tipo: TipoCuentaCredito,
        limite?: number | null, notas?: string | null): Observable<CuentaCredito> {
    return this.api.post<CuentaCredito>(this.PATH, { titularUsuarioId, tipo, limite, notas });
  }

  /** El titular no se cambia: una cuenta es de quien responde por ella. Para otro, otra cuenta. */
  actualizar(id: number, cambios: {
    tipo?: TipoCuentaCredito | null; limite?: number | null;
    activo?: boolean | null; notas?: string | null;
  }): Observable<CuentaCredito> {
    return this.api.put<CuentaCredito>(`${this.PATH}/${id}`, cambios);
  }

  amarrar(id: number, pacienteId: number): Observable<CreditoAmarre> {
    return this.api.post<CreditoAmarre>(`${this.PATH}/${id}/pacientes/${pacienteId}`, {});
  }

  /** Desactiva el amarre; no borra el histórico, que es lo que explica las deudas ya cargadas. */
  desamarrar(id: number, pacienteId: number): Observable<void> {
    return this.api.delete<void>(`${this.PATH}/${id}/pacientes/${pacienteId}`);
  }

  /**
   * Cobrar la cuenta: lo del mes, de una vez.
   *
   * Por dentro es un pago normal por cada línea, por el mismo camino que cualquier otro cobro
   * de la clínica — de ahí salen el asiento del libro, el arqueo y el estado de cada cita. Los
   * pagos comparten una referencia para poder verse juntos en Pagos.
   */
  cobrar(id: number, req: CobroCreditoRequest): Observable<CobroCredito> {
    return this.api.post<CobroCredito>(`${this.PATH}/${id}/cobrar`, req);
  }
}
