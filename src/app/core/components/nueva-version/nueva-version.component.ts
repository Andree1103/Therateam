import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VersionService } from '../../services/version.service';

/**
 * Barra que avisa de que hay una versión nueva publicada.
 *
 * Avisa, no interrumpe: quien está a mitad de registrar una cita termina y actualiza cuando
 * quiera. Recargar por sorpresa le borraría el formulario a medias.
 */
@Component({
  selector: 'app-nueva-version',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nueva-version.component.html',
  styleUrls: ['./nueva-version.component.css'],
})
export class NuevaVersionComponent {
  actualizando = false;
  /** Se puede posponer: vuelve a salir en la siguiente comprobación. */
  oculto = false;

  constructor(public version: VersionService) {}

  actualizar(): void {
    this.actualizando = true;
    this.version.actualizar();
  }
}
