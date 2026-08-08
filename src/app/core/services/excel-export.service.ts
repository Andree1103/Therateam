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
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `${nombreArchivo}_${fecha}.xlsx`);
  }
}
