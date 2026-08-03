import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TratamientosRoutingModule } from './tratamientos-routing.module';
import { ListaTratamientosComponent } from './Pages/lista-tratamientos/lista-tratamientos.component';
import { DetalleTratamientoComponent } from './Pages/detalle-tratamiento/detalle-tratamiento.component';
import { PaginatorComponent } from '../../core/components/paginator/paginator.component';

@NgModule({
  declarations: [
    ListaTratamientosComponent,
    DetalleTratamientoComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule, TratamientosRoutingModule, PaginatorComponent]
})
export class TratamientosModule {}
