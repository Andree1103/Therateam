import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdelantosRoutingModule } from './adelantos-routing.module';
import { ListaAdelantosComponent } from './Pages/lista-adelantos/lista-adelantos.component';
import { AgregarSaldoComponent } from '../../core/components/agregar-saldo/agregar-saldo.component';

@NgModule({
  declarations: [ListaAdelantosComponent],
  imports: [CommonModule, FormsModule, AdelantosRoutingModule, AgregarSaldoComponent]
})
export class AdelantosModule {}
