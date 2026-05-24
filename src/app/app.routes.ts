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
      {
        path: 'citas',
        loadChildren: () => import('./components/citas/citas.module').then(m => m.CitasModule)
      },
      { path: '', redirectTo: 'citas', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
