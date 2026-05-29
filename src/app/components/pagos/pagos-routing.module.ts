import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaPagosComponent } from './Pages/lista-pagos/lista-pagos.component';

const routes: Routes = [
  { path: '', component: ListaPagosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PagosRoutingModule {}
