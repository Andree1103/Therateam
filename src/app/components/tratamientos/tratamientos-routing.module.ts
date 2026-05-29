import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaTratamientosComponent } from './Pages/lista-tratamientos/lista-tratamientos.component';

const routes: Routes = [
  { path: '', component: ListaTratamientosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TratamientosRoutingModule {}
