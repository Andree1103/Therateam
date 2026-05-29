import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PagosRoutingModule } from './pagos-routing.module';
import { ListaPagosComponent } from './Pages/lista-pagos/lista-pagos.component';

@NgModule({
  declarations: [ListaPagosComponent],
  imports: [CommonModule, FormsModule, PagosRoutingModule]
})
export class PagosModule {}
