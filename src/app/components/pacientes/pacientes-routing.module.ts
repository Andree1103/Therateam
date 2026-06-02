import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaPacientesComponent } from './Pages/lista-pacientes/lista-pacientes.component';
import { PerfilPacienteComponent } from './Pages/perfil-paciente/perfil-paciente.component';

const routes: Routes = [
  { path: '',    component: ListaPacientesComponent },
  { path: ':id', component: PerfilPacienteComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PacientesRoutingModule {}
