import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AtencionesRoutingModule } from './atenciones-routing.module';
import { ListaAtencionesComponent } from './Pages/lista-atenciones/lista-atenciones.component';

@NgModule({
  declarations: [ListaAtencionesComponent],
  imports: [CommonModule, FormsModule, AtencionesRoutingModule]
})
export class AtencionesModule {}
