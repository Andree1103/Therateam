import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerapeutasRoutingModule } from './terapeutas-routing.module';
import { ListaTerapeutasComponent } from './Pages/lista-terapeutas/lista-terapeutas.component';
import { PaginatorComponent } from '../../core/components/paginator/paginator.component';

@NgModule({
  declarations: [ListaTerapeutasComponent],
  imports: [CommonModule, FormsModule, TerapeutasRoutingModule, PaginatorComponent]
})
export class TerapeutasModule {}
