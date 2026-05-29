import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerapeutasRoutingModule } from './terapeutas-routing.module';
import { ListaTerapeutasComponent } from './Pages/lista-terapeutas/lista-terapeutas.component';

@NgModule({
  declarations: [ListaTerapeutasComponent],
  imports: [CommonModule, FormsModule, TerapeutasRoutingModule]
})
export class TerapeutasModule {}
