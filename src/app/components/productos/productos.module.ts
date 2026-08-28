import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductosRoutingModule } from './productos-routing.module';
import { ListaProductosComponent } from './Pages/lista-productos/lista-productos.component';

@NgModule({
  declarations: [ListaProductosComponent],
  imports: [CommonModule, FormsModule, ProductosRoutingModule]
})
export class ProductosModule {}
