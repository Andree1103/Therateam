import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaCajaComponent } from './Pages/lista-caja/lista-caja.component';

const routes: Routes = [
  { path: '', component: ListaCajaComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaRoutingModule {}
