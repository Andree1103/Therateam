import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlantillasRoutingModule } from './plantillas-routing.module';
import { ListaPlantillasComponent } from './Pages/lista-plantillas/lista-plantillas.component';

@NgModule({
  declarations: [ListaPlantillasComponent],
  imports: [CommonModule, FormsModule, PlantillasRoutingModule]
})
export class PlantillasModule {}
