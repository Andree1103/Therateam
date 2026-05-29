import { Routes } from '@angular/router';
import { AuthGuard } from './components/auth/Guards/auth.guard';
import { LayoutComponent } from './components/layout/layout.component';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./components/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'citas',      loadChildren: () => import('./components/citas/citas.module').then(m => m.CitasModule) },
      { path: 'pacientes',  loadChildren: () => import('./components/pacientes/pacientes.module').then(m => m.PacientesModule) },
      { path: 'terapeutas', loadChildren: () => import('./components/terapeutas/terapeutas.module').then(m => m.TerapeutasModule) },
      { path: 'pagos',      loadChildren: () => import('./components/pagos/pagos.module').then(m => m.PagosModule) },
      { path: '', redirectTo: 'citas', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
