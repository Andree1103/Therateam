import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Controles de paginación server-side reutilizables (selector de tamaño + prev/next + contador).
 * El componente no pagina nada por sí mismo — solo emite la página/tamaño elegidos, quien lo usa
 * decide cómo volver a pedir los datos (ver lista-seguridad para el patrón de referencia).
 */
@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paginator.component.html',
  styleUrls: ['./paginator.component.css']
})
export class PaginatorComponent {
  @Input() pagina = 0;                          // 0-based, como lo espera Spring
  @Input() tamanioPagina = 10;
  @Input() totalElementos = 0;
  @Input() totalPaginas = 0;
  @Input() itemsEnPagina = 0;                   // largo del array actual, para el rango "X–Y de Z"
  @Input() opciones: number[] = [5, 10, 15, 20];

  @Output() paginaChange = new EventEmitter<number>();
  @Output() tamanioPaginaChange = new EventEmitter<number>();

  get desde(): number {
    return this.totalElementos === 0 ? 0 : this.pagina * this.tamanioPagina + 1;
  }

  get hasta(): number {
    return this.pagina * this.tamanioPagina + this.itemsEnPagina;
  }

  cambiarTamanio(n: number): void {
    this.tamanioPaginaChange.emit(n);
  }

  anterior(): void {
    if (this.pagina > 0) this.paginaChange.emit(this.pagina - 1);
  }

  siguiente(): void {
    if (this.pagina < this.totalPaginas - 1) this.paginaChange.emit(this.pagina + 1);
  }
}
