import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../Services/auth.service';

@Component({
  selector: 'app-olvide-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './olvide-password.component.html',
  styleUrls: ['../Login/login.component.css'],
})
export class OlvidePasswordComponent {
  email = '';
  loading = false;
  enviado = false;
  errorMessage = '';

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (!this.email) return;
    this.loading = true;
    this.errorMessage = '';
    this.authService.forgotPassword(this.email).subscribe({
      next: () => { this.loading = false; this.enviado = true; },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo procesar la solicitud, intenta de nuevo';
      }
    });
  }
}
