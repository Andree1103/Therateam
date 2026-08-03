import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeguridadRoutingModule } from './seguridad-routing.module';
import { ListaSeguridadComponent } from './Pages/lista-seguridad/lista-seguridad.component';
import { PaginatorComponent } from '../../core/components/paginator/paginator.component';

@NgModule({
  declarations: [ListaSeguridadComponent],
  imports: [CommonModule, FormsModule, SeguridadRoutingModule, PaginatorComponent]
})
export class SeguridadModule {}
