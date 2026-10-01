import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

/**
 * Detecta que se publicó una versión nueva del front y ofrece recargar.
 *
 * EL PROBLEMA REAL NO ERA LA CACHÉ. Las cabeceras del hosting ya son correctas
 * (`Cache-Control: public, max-age=0, must-revalidate` en el HTML) y los bundles llevan hash en
 * el nombre, así que una recarga normal siempre trae lo último. Lo que pasaba es que nadie
 * recarga: la aplicación es de una sola página y la recepción deja la pestaña abierta toda la
 * mañana, así que Angular no vuelve a pedir el HTML y siguen con el build del día anterior.
 * Por eso "borrar la caché" parecía arreglarlo — lo que arreglaba era el F5 que venía detrás.
 *
 * CÓMO SE SABE LA VERSIÓN: no hace falta generar ningún fichero en el build. El nombre del
 * bundle principal YA identifica la versión (`main-36NCT6WX.js`): si cambia el código, cambia el
 * hash. Se compara el que está cargado en esta pestaña con el que anuncia el index.html recién
 * pedido al servidor. Si difieren, hay despliegue nuevo.
 *
 * En `ng serve` el bundle se llama `main.js` sin hash, así que los dos lados coinciden siempre y
 * el aviso nunca salta en desarrollo.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {

  /** true cuando el servidor tiene un build distinto al que corre en esta pestaña. */
  readonly hayNuevaVersion$ = new BehaviorSubject<boolean>(false);

  /** Cada cuánto se pregunta, en milisegundos. Es una petición mínima al HTML. */
  private readonly CADA = 5 * 60 * 1000;

  private versionEnUso: string | null = null;
  private comprobando = false;
  private readonly enNavegador: boolean;

  // El build hace prerender en Node, donde no existe `document`: leerlo al construir el servicio
  // rompia la compilacion entera. Todo esto solo tiene sentido en el navegador.
  constructor(private zone: NgZone, @Inject(PLATFORM_ID) plataforma: Object) {
    this.enNavegador = isPlatformBrowser(plataforma);
    if (this.enNavegador) this.versionEnUso = this.leerVersionCargada();
  }

  /**
   * Arranca la vigilancia. Se llama una sola vez desde AppComponent.
   *
   * Fuera de la zona de Angular para que el intervalo no dispare detección de cambios cada cinco
   * minutos sin necesidad; cuando hay algo que avisar se vuelve a entrar.
   */
  iniciar(): void {
    if (!this.enNavegador || !this.versionEnUso) return; // sin bundle identificable: nada que vigilar
    this.zone.runOutsideAngular(() => {
      setTimeout(() => this.comprobar(), 15_000);
      setInterval(() => this.comprobar(), this.CADA);
      // Volver a la pestaña es el momento natural: el usuario acaba de retomar el trabajo.
      window.addEventListener('focus', () => this.comprobar());
    });
  }

  /** Pregunta al servidor qué build tiene publicado ahora mismo. */
  async comprobar(): Promise<void> {
    if (!this.enNavegador || this.comprobando || this.hayNuevaVersion$.value || document.hidden) return;
    this.comprobando = true;
    try {
      // no-store: si esta petición se sirviera de caché, no se enteraría nunca de nada.
      const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const publicada = this.extraerVersion(await res.text());
      if (publicada && publicada !== this.versionEnUso) {
        this.zone.run(() => this.hayNuevaVersion$.next(true));
      }
    } catch {
      // Sin conexión o el hosting caído: no es asunto de este servicio, se reintenta luego.
    } finally {
      this.comprobando = false;
    }
  }

  /**
   * Recarga con la versión nueva.
   *
   * Se limpia el Cache Storage y se dan de baja los service workers por si alguna vez se añade
   * una PWA: hoy no hay ninguno, pero un service worker viejo es justo lo que dejaría a alguien
   * clavado en una versión antigua sin forma de salir.
   *
   * NO se toca localStorage: ahí vive el token de sesión y borrarlo echaría fuera a todo el
   * mundo, que es peor que el problema que se quiere resolver.
   */
  async actualizar(): Promise<void> {
    if (!this.enNavegador) return;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const nombres = await caches.keys();
        await Promise.all(nombres.map(n => caches.delete(n)));
      }
    } catch {
      // Si el navegador no deja limpiar, la recarga de abajo sigue valiendo.
    }
    location.reload();
  }

  /** El bundle que está corriendo ahora mismo en esta pestaña. */
  private leerVersionCargada(): string | null {
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'));
    const main = scripts.map(s => s.getAttribute('src') ?? '')
                        .find(src => /(^|\/)main[-.][^/]*\.js$/.test(src));
    return main ? main.split('/').pop()! : null;
  }

  /** El bundle que el servidor está sirviendo en su index.html. */
  private extraerVersion(html: string): string | null {
    const m = /(?:^|\/|")(main[-.][A-Za-z0-9]*\.js)/.exec(html);
    return m ? m[1] : null;
  }
}
