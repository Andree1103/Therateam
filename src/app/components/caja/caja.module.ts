import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CajaRoutingModule } from './caja-routing.module';
import { ListaCajaComponent } from './Pages/lista-caja/lista-caja.component';

@NgModule({
  declarations: [ListaCajaComponent],
  imports: [CommonModule, FormsModule, CajaRoutingModule]
})
export class CajaModule {}
