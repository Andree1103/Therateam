import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PacientesRoutingModule } from './pacientes-routing.module';
import { ListaPacientesComponent } from './Pages/lista-pacientes/lista-pacientes.component';
import { PerfilPacienteComponent } from './Pages/perfil-paciente/perfil-paciente.component';

@NgModule({
  declarations: [
    ListaPacientesComponent,
    PerfilPacienteComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule, PacientesRoutingModule]
})
export class PacientesModule {}
