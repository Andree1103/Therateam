import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionesRoutingModule } from './configuraciones-routing.module';
import { ConfiguracionesComponent } from './Pages/configuraciones/configuraciones.component';

@NgModule({
  declarations: [ConfiguracionesComponent],
  imports: [CommonModule, FormsModule, ConfiguracionesRoutingModule]
})
export class ConfiguracionesModule {}
