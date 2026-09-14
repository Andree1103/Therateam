import { Component, OnInit } from '@angular/core';
import { HistoriaClinicaService } from '../../../historia-clinica/Services/historia.service';
import {
  HcCampo, HcPlantilla, HcSeccion, TipoFicha, ETIQUETA_TIPO,
} from '../../../historia-clinica/Models/historia.model';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CatalogItem } from '../../../../core/models/catalog.model';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService } from '../../../auth/Services/auth.service';

/**
 * Plantillas de las fichas clínicas: la de la HISTORIA del paciente y la de la ATENCIÓN de
 * cada sesión. Las dos se arman igual (secciones → campos), por eso comparten pantalla y solo
 * cambian de pestaña.
 *
 * Cada plantilla se ata a un TIPO DE TERAPIA, no a un área: el área es demasiado gruesa (una
 * Evaluación Psicológica y una Terapia de Lenguaje son las dos de Kids y no preguntan lo
 * mismo), y el tipo de terapia es lo que ya lleva la cita, así la plantilla de una atención
 * se resuelve sola. Si un tipo no tiene la suya, se usa la genérica.
 */
@Component({
  selector: 'app-lista-plantillas',
  templateUrl: './lista-plantillas.component.html',
  styleUrls: ['./lista-plantillas.component.css']
})
export class ListaPlantillasComponent implements OnInit {

  tipoActivo: TipoFicha = 'HISTORIA';
  plantillas: HcPlantilla[] = [];
  cargando = false;

  /** Plantilla abierta en el editor; null = se está viendo el listado. */
  edicion: HcPlantilla | null = null;
  guardando = false;

  /** Del catálogo: se usa el id numérico, que es lo que referencia la plantilla. */
  tiposTerapia: CatalogItem[] = [];
  readonly tiposCampo = Object.entries(ETIQUETA_TIPO).map(([valor, etiqueta]) => ({ valor, etiqueta }));

  constructor(
    private historiaService: HistoriaClinicaService,
    private catalogService: CatalogService,
    private toast: ToastService,
    private authService: AuthService,
  ) {}

  get puedeCrear(): boolean { return this.authService.puedeCrear('CONFIGURACIONES'); }
  get puedeEditar(): boolean { return this.authService.puedeEditar('CONFIGURACIONES'); }
  get puedeEliminar(): boolean { return this.authService.puedeEliminar('CONFIGURACIONES'); }

  ngOnInit(): void {
    this.catalogService.getTiposTerapia().subscribe({
      next: d => this.tiposTerapia = d,
      error: () => {}
    });
    this.cargar();
  }

  cambiarTipo(tipo: TipoFicha): void {
    if (this.tipoActivo === tipo) return;
    this.tipoActivo = tipo;
    this.edicion = null;
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    // `todas` incluye las desactivadas: desde acá se administran, hay que poder verlas.
    this.historiaService.getPlantillas(this.tipoActivo, true).subscribe({
      next: d => { this.plantillas = d; this.cargando = false; },
      error: () => { this.cargando = false; this.toast.error('Error al cargar las plantillas'); }
    });
  }

  // ── Listado ────────────────────────────────────────────────────────────────

  contarCampos(p: HcPlantilla): number {
    return p.secciones.reduce((n, s) => n + s.campos.length, 0);
  }

  nombreTipoTerapia(p: HcPlantilla): string {
    return p.tipoTerapia?.nombre ?? 'Todos los tipos';
  }

  // ── Editor ─────────────────────────────────────────────────────────────────

  nueva(): void {
    this.edicion = {
      nombre: '', tipo: this.tipoActivo, descripcion: '', activo: true,
      orden: this.plantillas.length, tipoTerapia: null,
      secciones: [{ nombre: this.tipoActivo === 'ATENCION' ? 'Nota de la sesión' : 'Datos generales', orden: 0, campos: [] }],
    };
  }

  /** Se edita una copia: cancelar no debe dejar a medias la plantilla del listado. */
  editar(p: HcPlantilla): void { this.edicion = JSON.parse(JSON.stringify(p)); }

  /** Duplicar es la forma práctica de tener una por tipo de terapia sin empezar de cero. */
  duplicar(p: HcPlantilla): void {
    const copia: HcPlantilla = JSON.parse(JSON.stringify(p));
    delete copia.id;
    copia.nombre = `${p.nombre} (copia)`;
    copia.secciones.forEach(s => { delete s.id; s.campos.forEach(c => delete c.id); });
    this.edicion = copia;
  }

  cancelar(): void { this.edicion = null; }

  agregarSeccion(): void {
    this.edicion?.secciones.push({ nombre: '', orden: this.edicion.secciones.length, campos: [] });
  }

  quitarSeccion(i: number): void { this.edicion?.secciones.splice(i, 1); }

  agregarCampo(sec: HcSeccion): void {
    sec.campos.push({ clave: '', etiqueta: '', tipo: 'TEXTO', requerido: false, orden: sec.campos.length });
  }

  quitarCampo(sec: HcSeccion, i: number): void { sec.campos.splice(i, 1); }

  /** Sugiere la clave desde la etiqueta, para no tener que inventarla a mano. */
  sugerirClave(campo: HcCampo): void {
    if (campo.id || campo.clave?.trim()) return; // una clave ya guardada no se toca: perdería el dato
    campo.clave = (campo.etiqueta || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }

  /** Las opciones se editan como texto separado por comas; el backend espera un arreglo. */
  opcionesTexto(campo: HcCampo): string { return (campo.opciones ?? []).join(', '); }

  setOpcionesTexto(campo: HcCampo, texto: string): void {
    campo.opciones = texto.split(',').map(o => o.trim()).filter(o => o.length > 0);
  }

  esCampoDeLista(campo: HcCampo): boolean {
    return campo.tipo === 'SELECT' || campo.tipo === 'MULTISELECT';
  }

  guardar(): void {
    const p = this.edicion;
    if (!p) return;
    // El orden sale de la posición en pantalla: lo que el admin ve arriba va primero.
    p.secciones.forEach((s, i) => { s.orden = i; s.campos.forEach((c, j) => c.orden = j); });
    this.guardando = true;
    const peticion = p.id
      ? this.historiaService.actualizarPlantilla(p.id, p)
      : this.historiaService.crearPlantilla(p);
    peticion.subscribe({
      next: () => {
        this.toast.success(p.id ? 'Plantilla actualizada' : 'Plantilla creada');
        this.guardando = false;
        this.edicion = null;
        this.cargar();
      },
      error: err => {
        this.guardando = false;
        this.toast.error(err?.error?.error || 'No se pudo guardar la plantilla');
      }
    });
  }

  eliminar(p: HcPlantilla): void {
    if (!p.id) return;
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"?\n\nSi ya tiene fichas cargadas se desactivará en vez de borrarse, para no perderlas.`)) return;
    this.historiaService.eliminarPlantilla(p.id).subscribe({
      next: r => {
        this.toast.success(r.resultado === 'DESACTIVADA'
          ? 'La plantilla tenía fichas cargadas: se desactivó en vez de borrarse'
          : 'Plantilla eliminada');
        this.cargar();
      },
      error: () => this.toast.error('No se pudo eliminar la plantilla')
    });
  }
}
