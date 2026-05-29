import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaTerapeutasComponent } from './Pages/lista-terapeutas/lista-terapeutas.component';

const routes: Routes = [
  { path: '', component: ListaTerapeutasComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TerapeutasRoutingModule {}
