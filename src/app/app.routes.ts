import { Routes } from '@angular/router';
import { moduloGuard } from './components/auth/Guards/modulo.guard';
import { LayoutComponent } from './components/layout/layout.component';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./components/auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'olvide-password',
    loadComponent: () => import('./components/auth/Pages/OlvidePassword/olvide-password.component').then(m => m.OlvidePasswordComponent)
  },
  {
    path: 'restablecer-password',
    loadComponent: () => import('./components/auth/Pages/RestablecerPassword/restablecer-password.component').then(m => m.RestablecerPasswordComponent)
  },
  {
    path: 'sin-acceso',
    loadComponent: () => import('./components/auth/Pages/SinAcceso/sin-acceso.component').then(m => m.SinAccesoComponent),
    canActivate: [moduloGuard],
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [moduloGuard],
    children: [
      { path: 'dashboard',       data: { modulo: 'DASHBOARD' },       canActivate: [moduloGuard], loadChildren: () => import('./components/dashboard/dashboard.module').then(m => m.DashboardModule) },
      { path: 'citas',           data: { modulo: 'CITAS' },           canActivate: [moduloGuard], loadChildren: () => import('./components/citas/citas.module').then(m => m.CitasModule) },
      { path: 'pacientes',       data: { modulo: 'PACIENTES' },       canActivate: [moduloGuard], loadChildren: () => import('./components/pacientes/pacientes.module').then(m => m.PacientesModule) },
      { path: 'terapeutas',      data: { modulo: 'TERAPEUTAS' },      canActivate: [moduloGuard], loadChildren: () => import('./components/terapeutas/terapeutas.module').then(m => m.TerapeutasModule) },
      { path: 'pagos',           data: { modulo: 'PAGOS' },           canActivate: [moduloGuard], loadChildren: () => import('./components/pagos/pagos.module').then(m => m.PagosModule) },
      { path: 'caja',            data: { modulo: 'CAJA' },            canActivate: [moduloGuard], loadChildren: () => import('./components/caja/caja.module').then(m => m.CajaModule) },
      { path: 'tratamientos',    data: { modulo: 'PAQUETES' },        canActivate: [moduloGuard], loadChildren: () => import('./components/tratamientos/tratamientos.module').then(m => m.TratamientosModule) },
      { path: 'configuraciones', data: { modulo: 'CONFIGURACIONES' }, canActivate: [moduloGuard], loadChildren: () => import('./components/configuraciones/configuraciones.module').then(m => m.ConfiguracionesModule) },
      { path: 'seguridad',       data: { modulo: 'SEGURIDAD' },       canActivate: [moduloGuard], loadChildren: () => import('./components/seguridad/seguridad.module').then(m => m.SeguridadModule) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
