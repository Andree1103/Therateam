import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NuevaVersionComponent } from './core/components/nueva-version/nueva-version.component';
import { VersionService } from './core/services/version.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NuevaVersionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'therateam';

  constructor(private version: VersionService) {}

  /** Vigila si se publica una version nueva mientras la pestana sigue abierta. */
  ngOnInit(): void {
    this.version.iniciar();
  }
}
