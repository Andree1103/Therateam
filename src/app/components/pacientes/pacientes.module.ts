import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PacientesRoutingModule } from './pacientes-routing.module';
import { ListaPacientesComponent } from './Pages/lista-pacientes/lista-pacientes.component';

@NgModule({
  declarations: [ListaPacientesComponent],
  imports: [CommonModule, FormsModule, PacientesRoutingModule]
})
export class PacientesModule {}
