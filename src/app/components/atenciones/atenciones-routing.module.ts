import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaAtencionesComponent } from './Pages/lista-atenciones/lista-atenciones.component';

const routes: Routes = [
  { path: '', component: ListaAtencionesComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AtencionesRoutingModule {}
