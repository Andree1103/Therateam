import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CitaService } from '../../Services/cita.service';
import { CrearCitaRequest } from '../../Models/cita.model';

@Component({
  selector: 'app-crear-cita',
  templateUrl: './crear-cita.component.html',
  styleUrls: ['./crear-cita.component.css']
})
export class CrearCitaComponent implements OnInit {
  cita: CrearCitaRequest = {
    sesion_id: 0,
    terapeuta_id: '',
    paciente_id: '',
    tipo_terapia_id: 0,
    fecha_inicio: new Date(),
    fecha_fin: new Date(),
    duracion_minutos: 50,
    modalidad: 'PRESENCIAL',
    notas_previas: ''
  };

  pacientes = [
    { id: '1001', nombre: 'Juan Pérez' },
    { id: '1002', nombre: 'María López' },
    { id: '1003', nombre: 'Carlos Rodríguez' },
    { id: '1004', nombre: 'Ana Martínez' }
  ];

  terapeutas = [
    { id: '2', nombre: 'María González' },
    { id: '3', nombre: 'Carlos Ruiz' }
  ];

  tiposTerapia = [
    { id: 1, nombre: 'Evaluación Inicial', duracion: 60 },
    { id: 2, nombre: 'Rodilla', duracion: 45 },
    { id: 3, nombre: 'Columna', duracion: 50 },
    { id: 4, nombre: 'Hombro', duracion: 45 },
    { id: 5, nombre: 'Post Operatorio', duracion: 60 }
  ];

  modalidades = ['PRESENCIAL', 'VIRTUAL', 'DOMICILIO'];
  loading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  horasDisponibles: string[] = [];
  fechaMinima: string = '';  // ← Agregar esta propiedad

  constructor(
    private citaService: CitaService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.generarHorasDisponibles();
    this.setFechaMinima();  // ← Llamar a la función
  }

  setFechaMinima(): void {
    const today = new Date();
    this.fechaMinima = today.toISOString().split('T')[0];
  }

  generarHorasDisponibles(): void {
    // Generar horas de 8:00 a 20:00
    for (let i = 8; i <= 20; i++) {
      this.horasDisponibles.push(`${i.toString().padStart(2, '0')}:00`);
      this.horasDisponibles.push(`${i.toString().padStart(2, '0')}:30`);
    }
  }

  onTipoTerapiaChange(): void {
    const terapiaSeleccionada = this.tiposTerapia.find(
      t => t.id === this.cita.tipo_terapia_id
    );
    if (terapiaSeleccionada) {
      this.cita.duracion_minutos = terapiaSeleccionada.duracion;
      this.calcularFechaFin();
    }
  }

  onFechaHoraChange(): void {
    this.calcularFechaFin();
  }

  calcularFechaFin(): void {
    if (this.cita.fecha_inicio) {
      const fechaFin = new Date(this.cita.fecha_inicio);
      fechaFin.setMinutes(fechaFin.getMinutes() + this.cita.duracion_minutos);
      this.cita.fecha_fin = fechaFin;
    }
  }

  onSubmit(): void {
    // Validaciones
    if (!this.cita.paciente_id) {
      this.errorMessage = 'Por favor seleccione un paciente';
      return;
    }
    if (!this.cita.terapeuta_id) {
      this.errorMessage = 'Por favor seleccione un terapeuta';
      return;
    }
    if (!this.cita.tipo_terapia_id) {
      this.errorMessage = 'Por favor seleccione un tipo de terapia';
      return;
    }
    if (!this.cita.fecha_inicio) {
      this.errorMessage = 'Por favor seleccione fecha y hora';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Asignar un ID de sesión temporal
    this.cita.sesion_id = Math.floor(Math.random() * 1000) + 100;

    this.citaService.crearCita(this.cita).subscribe({
      next: (citaCreada) => {
        this.successMessage = 'Cita creada exitosamente';
        setTimeout(() => {
          this.router.navigate(['/citas', citaCreada.id]);
        }, 1500);
      },
      error: (error) => {
        this.errorMessage = 'Error al crear la cita: ' + error.message;
        this.loading = false;
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/citas']);
  }

  getPacienteNombre(id: string): string {
    const paciente = this.pacientes.find(p => p.id === id);
    return paciente ? paciente.nombre : '';
  }

  getTerapeutaNombre(id: string): string {
    const terapeuta = this.terapeutas.find(t => t.id === id);
    return terapeuta ? terapeuta.nombre : '';
  }
}