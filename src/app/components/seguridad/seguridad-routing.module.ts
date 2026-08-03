import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaSeguridadComponent } from './Pages/lista-seguridad/lista-seguridad.component';

const routes: Routes = [
  { path: '', component: ListaSeguridadComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SeguridadRoutingModule {}
