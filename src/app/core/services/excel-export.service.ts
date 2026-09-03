import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

@Injectable({ providedIn: 'root' })
export class ExcelExportService {

  /**
   * Exporta un arreglo de objetos planos a un .xlsx descargable. Cada fila usa las columnas
   * definidas en `filas[0]` (por eso conviene mapear los datos a un objeto con las etiquetas
   * de columna ya en español antes de llamar esto, no las entidades crudas del backend).
   */
  exportar(filas: Record<string, unknown>[], nombreArchivo: string, nombreHoja = 'Datos'): void {
    this.exportarLibro([{ nombre: nombreHoja, filas }], nombreArchivo);
  }

  /**
   * Un solo archivo con varias hojas — para exportar cosas que se leen juntas (ej. las citas,
   * atenciones y pagos de un paciente), en vez de obligar a descargar tres archivos sueltos.
   *
   * Las hojas vacías se omiten: una pestaña en blanco solo estorba. Excel limita el nombre de
   * hoja a 31 caracteres y no admite : \ / ? * [ ], así que se recortan y limpian.
   */
  exportarLibro(hojas: { nombre: string; filas: Record<string, unknown>[] }[], nombreArchivo: string): void {
    const libro = XLSX.utils.book_new();
    let alguna = false;

    for (const h of hojas) {
      if (!h.filas || h.filas.length === 0) continue;
      const nombreHoja = h.nombre.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
      XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(h.filas), nombreHoja);
      alguna = true;
    }
    if (!alguna) return;

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `${nombreArchivo}_${fecha}.xlsx`);
  }
}
