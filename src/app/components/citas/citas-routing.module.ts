import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaCitasComponent } from './Pages/lista-citas/lista-citas.component';
import { CrearCitaComponent } from './Pages/crear-cita/crear-cita.component';
import { DetalleCitaComponent } from './Pages/detalle-cita/detalle-cita.component';

const routes: Routes = [
  { path: '', component: ListaCitasComponent },
  { path: 'nueva', component: CrearCitaComponent },
  { path: ':id', component: DetalleCitaComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CitasRoutingModule { }