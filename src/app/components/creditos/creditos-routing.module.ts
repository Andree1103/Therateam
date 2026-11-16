import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaCreditosComponent } from './Pages/lista-creditos/lista-creditos.component';

const routes: Routes = [
  { path: '', component: ListaCreditosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CreditosRoutingModule {}
