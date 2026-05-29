import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfiguracionesComponent } from './Pages/configuraciones/configuraciones.component';

const routes: Routes = [
  { path: '', component: ConfiguracionesComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConfiguracionesRoutingModule {}
