import { Routes } from '@angular/router';
import { AuthGuard } from './components/auth/Guards/auth.guard';

export const routes: Routes = [
  { 
    path: 'login', 
    loadChildren: () => import('./components/auth/auth.module').then(m => m.AuthModule)
  },
  { 
    path: 'citas', 
    loadChildren: () => import('./components/citas/citas.module').then(m => m.CitasModule),
    canActivate: [AuthGuard]
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];