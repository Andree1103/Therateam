import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CitaService } from '../../Services/cita.service';
import { Cita, ReprogramarCitaRequest } from '../../Models/cita.model';

@Component({
  selector: 'app-detalle-cita',
  templateUrl: './detalle-cita.component.html',
  styleUrls: ['./detalle-cita.component.css']
})
export class DetalleCitaComponent implements OnInit {
  cita: Cita | null = null;
  loading: boolean = true;
  showReprogramarModal: boolean = false;
  showCancelarModal: boolean = false;
  motivoCancelacion: string = '';
  
  reprogramarData: ReprogramarCitaRequest = {
    nueva_fecha_inicio: new Date(),
    nueva_fecha_fin: new Date(),
    motivo: ''
  };

  horasDisponibles: string[] = [];
  terapeutas = [
    { id: '2', nombre: 'María González' },
    { id: '3', nombre: 'Carlos Ruiz' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private citaService: CitaService
  ) {}

  ngOnInit(): void {
    this.generarHorasDisponibles();
    this.cargarCita();
  }

  generarHorasDisponibles(): void {
    for (let i = 8; i <= 20; i++) {
      this.horasDisponibles.push(`${i.toString().padStart(2, '0')}:00`);
      this.horasDisponibles.push(`${i.toString().padStart(2, '0')}:30`);
    }
  }

  cargarCita(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.citaService.getCitaById(id).subscribe({
        next: (cita) => {
          this.cita = cita;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar cita:', error);
          this.loading = false;
          this.router.navigate(['/citas']);
        }
      });
    } else {
      this.router.navigate(['/citas']);
    }
  }

  confirmarCita(): void {
    if (this.cita) {
      this.citaService.confirmarCita(this.cita.id).subscribe({
        next: () => {
          this.cargarCita();
        },
        error: (error) => {
          console.error('Error al confirmar cita:', error);
        }
      });
    }
  }

  abrirModalReprogramar(): void {
    if (this.cita) {
      this.reprogramarData.nueva_fecha_inicio = new Date(this.cita.fecha_inicio);
      this.reprogramarData.nueva_fecha_fin = new Date(this.cita.fecha_fin);
      this.reprogramarData.motivo = '';
      this.showReprogramarModal = true;
    }
  }

  cerrarModalReprogramar(): void {
    this.showReprogramarModal = false;
  }

  guardarReprogramacion(): void {
    if (this.cita && this.reprogramarData.motivo) {
      this.citaService.reprogramarCita(this.cita.id, this.reprogramarData).subscribe({
        next: () => {
          this.cerrarModalReprogramar();
          this.cargarCita();
        },
        error: (error) => {
          console.error('Error al reprogramar:', error);
        }
      });
    }
  }

  abrirModalCancelar(): void {
    this.motivoCancelacion = '';
    this.showCancelarModal = true;
  }

  cerrarModalCancelar(): void {
    this.showCancelarModal = false;
  }

  confirmarCancelacion(): void {
    if (this.cita && this.motivoCancelacion) {
      this.citaService.cancelarCita(this.cita.id, this.motivoCancelacion).subscribe({
        next: () => {
          this.cerrarModalCancelar();
          this.cargarCita();
        },
        error: (error) => {
          console.error('Error al cancelar:', error);
        }
      });
    }
  }

  volver(): void {
    this.router.navigate(['/citas']);
  }

  getEstadoClass(estado: string): string {
    const classes: { [key: string]: string } = {
      'PROGRAMADA': 'status-scheduled',
      'CONFIRMADA': 'status-confirmed',
      'EN_CURSO': 'status-in-progress',
      'ASISTIDA': 'status-completed',
      'NO_ASISTIO': 'status-missed',
      'REPROGRAMADA': 'status-rescheduled',
      'CANCELADA_PACIENTE': 'status-cancelled',
      'CANCELADA_CLINICA': 'status-cancelled'
    };
    return classes[estado] || 'status-pending';
  }

  getModalidadIcon(modalidad: string): string {
    const icons: { [key: string]: string } = {
      'PRESENCIAL': '🏥',
      'VIRTUAL': '💻',
      'DOMICILIO': '🏠'
    };
    return icons[modalidad] || '📅';
  }

  calcularFechaFin(fechaInicio: Date, duracion: number): Date {
    const fecha = new Date(fechaInicio);
    fecha.setMinutes(fecha.getMinutes() + duracion);
    return fecha;
  }
}