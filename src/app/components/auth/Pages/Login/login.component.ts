import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../Services/auth.service';

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

    setTimeout(() => {
      const success = this.authService.login(this.email, this.password);
      
      if (success) {
        this.router.navigate(['/citas']);
      } else {
        this.errorMessage = 'Email o contraseña incorrectos';
      }
      
      this.loading = false;
    }, 500);
  }
}