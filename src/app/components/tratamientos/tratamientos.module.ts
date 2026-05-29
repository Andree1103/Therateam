import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TratamientosRoutingModule } from './tratamientos-routing.module';
import { ListaTratamientosComponent } from './Pages/lista-tratamientos/lista-tratamientos.component';

@NgModule({
  declarations: [ListaTratamientosComponent],
  imports: [CommonModule, FormsModule, TratamientosRoutingModule]
})
export class TratamientosModule {}
