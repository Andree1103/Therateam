import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ListaCitasComponent } from './Pages/lista-citas/lista-citas.component';
import { CrearCitaComponent } from './Pages/crear-cita/crear-cita.component';
import { DetalleCitaComponent } from './Pages/detalle-cita/detalle-cita.component';

const routes = [
  { path: '', component: ListaCitasComponent },
  { path: 'nueva', component: CrearCitaComponent },
  { path: ':id', component: DetalleCitaComponent }
];

@NgModule({
  declarations: [
    ListaCitasComponent,
    CrearCitaComponent,
    DetalleCitaComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class CitasModule { }