import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaAdelantosComponent } from './Pages/lista-adelantos/lista-adelantos.component';

const routes: Routes = [
  { path: '', component: ListaAdelantosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdelantosRoutingModule {}
