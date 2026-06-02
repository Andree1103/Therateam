import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaTratamientosComponent } from './Pages/lista-tratamientos/lista-tratamientos.component';
import { DetalleTratamientoComponent } from './Pages/detalle-tratamiento/detalle-tratamiento.component';

const routes: Routes = [
  { path: '',    component: ListaTratamientosComponent },
  { path: ':id', component: DetalleTratamientoComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TratamientosRoutingModule {}
