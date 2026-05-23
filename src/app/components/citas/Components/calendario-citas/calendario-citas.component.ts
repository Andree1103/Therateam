import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-calendario-citas',
  template: `
    <div class="calendario">
      <h3>Calendario</h3>
      <input type="date" (change)="onFechaChange($event)">
    </div>
  `,
  styles: [`
    .calendario {
      padding: 15px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  `]
})
export class CalendarioCitasComponent {
  @Output() fechaSeleccionada = new EventEmitter<string>();

  onFechaChange(event: any) {
    this.fechaSeleccionada.emit(event.target.value);
  }
}