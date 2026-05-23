import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-filtro-citas',
  template: `
    <div class="filtros">
      <select (change)="onEstadoChange($event)">
        <option value="">Todos los estados</option>
        <option *ngFor="let estado of estados" [value]="estado">
          {{ estado }}
        </option>
      </select>
    </div>
  `,
  styles: [`
    .filtros {
      margin-bottom: 15px;
    }
    select {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }
  `]
})
export class FiltroCitasComponent {
  estados = ['PROGRAMADA', 'CONFIRMADA', 'ASISTIDA', 'CANCELADA'];
  @Output() estadoSeleccionado = new EventEmitter<string>();

  onEstadoChange(event: any) {
    this.estadoSeleccionado.emit(event.target.value);
  }
}