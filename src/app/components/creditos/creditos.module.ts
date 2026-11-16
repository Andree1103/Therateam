import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreditosRoutingModule } from './creditos-routing.module';
import { ListaCreditosComponent } from './Pages/lista-creditos/lista-creditos.component';

@NgModule({
  declarations: [ListaCreditosComponent],
  imports: [CommonModule, FormsModule, CreditosRoutingModule]
})
export class CreditosModule {}
