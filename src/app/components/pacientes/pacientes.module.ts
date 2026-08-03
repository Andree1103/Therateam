import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PacientesRoutingModule } from './pacientes-routing.module';
import { ListaPacientesComponent } from './Pages/lista-pacientes/lista-pacientes.component';
import { PerfilPacienteComponent } from './Pages/perfil-paciente/perfil-paciente.component';
import { PaginatorComponent } from '../../core/components/paginator/paginator.component';

@NgModule({
  declarations: [
    ListaPacientesComponent,
    PerfilPacienteComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule, PacientesRoutingModule, PaginatorComponent]
})
export class PacientesModule {}
