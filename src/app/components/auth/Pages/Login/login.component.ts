import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../Services/auth.service';
import { MODULO_RUTA } from '../../modulo-rutas';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor ingrese email y contraseña';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        this.loading = false;
        const ruta = user.modulos.includes('CITAS') ? 'citas' : MODULO_RUTA[user.modulos[0]] ?? 'citas';
        this.router.navigate([`/${ruta}`]);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Email o contraseña incorrectos';
      }
    });
  }
}