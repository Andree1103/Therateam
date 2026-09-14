import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListaPlantillasComponent } from './Pages/lista-plantillas/lista-plantillas.component';

const routes: Routes = [
  { path: '', component: ListaPlantillasComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PlantillasRoutingModule {}
