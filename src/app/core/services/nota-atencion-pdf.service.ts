import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ClinicaInfo {
  nombreNegocio: string;
  direccion: string;
  telefono: string;
}

export interface NotaAtencionData {
  dni: string;
  paciente: string;
  fechaCita: Date;
  areaNombre: string;
  tipoNombre: string;
  profesional: string;
}

export interface CronogramaSesion {
  numero: number;
  fecha: Date | null;
  areaNombre: string;
  estado: string;
}

export interface CronogramaData {
  dni: string;
  paciente: string;
  terapeuta: string;
  areaNombre: string;
  paqueteNombre: string;
  sesiones: CronogramaSesion[];
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function horaAmPm(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function turno(d: Date): string {
  return d.getHours() < 13 ? 'MAÑANA' : 'TARDE';
}

function fechaDDMMYYYY(d: Date): string {
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

@Injectable({ providedIn: 'root' })
export class NotaAtencionPdfService {

  /** Recibo de una sola cita — para descargar y enviar por WhatsApp al paciente. */
  descargarNota(data: NotaAtencionData, clinica: ClinicaInfo): void {
    const doc = new jsPDF({ unit: 'mm', format: [105, 148] }); // media carta aprox., tamaño de recibo
    const W = doc.internal.pageSize.getWidth();
    let y = 10;
    const centrar = (texto: string, tam: number, negrita = false) => {
      doc.setFontSize(tam);
      doc.setFont('helvetica', negrita ? 'bold' : 'normal');
      doc.text(texto, W / 2, y, { align: 'center' });
      y += tam * 0.5;
    };

    const hoy = new Date();
    centrar(`${DIAS[hoy.getDay()].toUpperCase()} ${String(hoy.getDate()).padStart(2, '0')} ${MESES[hoy.getMonth()].toUpperCase()} ${hoy.getFullYear()}`, 9, true);
    y += 2;
    centrar(clinica.direccion.toUpperCase(), 8);
    centrar(clinica.telefono, 8);
    y += 4;
    centrar('NOTA DE ATENCIÓN', 13, true);
    y += 3;
    centrar(data.areaNombre.toUpperCase(), 12, true);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const campo = (label: string, valor: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 8, y);
      doc.setFont('helvetica', 'normal');
      doc.text(valor, 32, y);
      y += 6;
    };
    campo('DNI:', data.dni);
    campo('Paciente:', data.paciente.toUpperCase());
    y += 3;
    campo('Fecha de cita:', fechaDDMMYYYY(data.fechaCita));
    campo('Turno:', turno(data.fechaCita));
    campo('Hora:', horaAmPm(data.fechaCita));
    campo('Profesional:', data.profesional.toUpperCase());
    campo('Tipo:', data.tipoNombre.toUpperCase());
    y += 4;

    doc.setFontSize(7.5);
    const nota = (texto: string) => {
      const lineas = doc.splitTextToSize(texto, W - 16);
      doc.text(lineas, 8, y);
      y += lineas.length * 4 + 3;
    };
    nota('* RECUERDE ACUDIR 10 MINUTOS ANTES DE LA CITA.');
    nota('* EN CASO DE NO ACUDIR A LA CITA INDICADA, NO HAY LUGAR A REPROGRAMACIÓN, NI DEVOLUCIÓN DE DINERO.');
    nota('* EN CASO DE LLEGAR TARDE, SE LE ATENDERÁ EL TIEMPO RESTANTE.');

    doc.save(`nota-atencion-${data.dni}-${fechaDDMMYYYY(data.fechaCita).replace(/\//g, '-')}.pdf`);
  }

  /** Cronograma de sesiones de un paquete — para descargar y enviar por WhatsApp al paciente. */
  descargarCronograma(data: CronogramaData, clinica: ClinicaInfo): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    let y = 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(clinica.nombreNegocio.toUpperCase(), 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const campo = (x: number, label: string, valor: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(valor, x + 22, y);
    };
    campo(14, 'DNI:', data.dni);
    campo(110, 'PACIENTE:', data.paciente.toUpperCase());
    y += 6;
    campo(14, 'TERAPEUTA:', data.terapeuta.toUpperCase());
    campo(110, 'ÁREA:', data.areaNombre.toUpperCase());
    y += 6;
    campo(14, 'PAQUETE:', data.paqueteNombre.toUpperCase());
    y += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CRONOGRAMA DE ATENCIONES', W / 2, y, { align: 'center' });
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Sesión', 'Fecha', 'Hora', 'Día', 'Área', 'Estado']],
      body: data.sesiones.map(s => [
        String(s.numero),
        s.fecha ? fechaDDMMYYYY(s.fecha) : '',
        s.fecha ? horaAmPm(s.fecha) : '',
        s.fecha ? DIAS[s.fecha.getDay()] : '',
        s.areaNombre,
        s.estado || '',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [24, 95, 165] },
      styles: { fontSize: 9 },
    });

    // @ts-expect-error jspdf-autotable extiende el doc con lastAutoTable en runtime
    y = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const nota = (texto: string) => {
      const lineas = doc.splitTextToSize(texto, W - 28);
      doc.text(lineas, 14, y);
      y += lineas.length * 4 + 2;
    };
    nota('* RECUERDE ACUDIR 10 MINUTOS ANTES DE LA CITA.');
    nota('* EN CASO DE NO ACUDIR A LA CITA INDICADA, NO HAY LUGAR A REPROGRAMACIÓN, NI DEVOLUCIÓN DE DINERO.');
    nota('* SI EL PACIENTE LLEGA TARDE, SOLO SE LE ATENDERÁ EL TIEMPO RESTANTE.');

    y += 10;
    doc.text('FIRMA: _______________________________', 14, y);
    y += 8;
    doc.text('DNI: _______________________________', 14, y);

    doc.save(`cronograma-${data.dni}.pdf`);
  }
}
