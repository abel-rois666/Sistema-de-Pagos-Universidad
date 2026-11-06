import { jsPDF } from 'jspdf';
import type { PaymentPlan } from '../types';
import { inspectPlan } from '../utils/planCoverageUtils';

export interface PagoProgramado {
  numero: number;
  concepto: string;
  fecha: string;
  cantidad: number;
}

/** Muestra solo las filas usadas, con preferencia por detalles normalizados. */
export function pagosProgramados(plan: PaymentPlan): PagoProgramado[] {
  if (!inspectPlan(plan).completo) throw new Error('El plan de pagos está incompleto.');
  const detalles = plan.detalles || [];
  if (detalles.length) return detalles
    .filter(fila => fila.indice_concepto >= 1 && fila.indice_concepto <= 18)
    .filter(fila => fila.concepto?.trim() || fila.fecha_vencimiento || Number(fila.cantidad) !== 0)
    .sort((a, b) => a.indice_concepto - b.indice_concepto)
    .map(fila => ({ numero: fila.indice_concepto, concepto: fila.concepto.trim(),
      fecha: fila.fecha_vencimiento!, cantidad: Number(fila.cantidad) }));
  const campos = plan as unknown as Record<string, unknown>;
  return Array.from({ length: 18 }, (_, indice) => indice + 1)
    .filter(numero => {
      const concepto = String(campos[`concepto_${numero}`] || '').trim();
      const fecha = String(campos[`fecha_${numero}`] || '').trim();
      const cantidad = campos[`cantidad_${numero}`];
      return Boolean(concepto || fecha || (cantidad != null && cantidad !== '' && Number(cantidad) !== 0));
    })
    .map(numero => ({ numero, concepto: String(campos[`concepto_${numero}`]).trim(),
      fecha: String(campos[`fecha_${numero}`]).trim(), cantidad: Number(campos[`cantidad_${numero}`]) }));
}

const moneda = (valor: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor);
const fechaLocal = (iso: string) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
};

/** Calendario informativo: no muestra saldos ni sustituye el estado de cuenta. */
export function crearPdfCalendarioPagos(plan: PaymentPlan, cicloNombre: string): jsPDF {
  const filas = pagosProgramados(plan);
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  const margen = 17;
  pdf.setFillColor(22, 43, 66);
  pdf.rect(0, 0, 216, 35, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
  pdf.text('CALENDARIO DE PAGOS', margen, 18);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  pdf.text(`Ciclo ${cicloNombre}  ·  Folio ${plan.no_plan_pagos}`, margen, 26);
  pdf.setTextColor(22, 43, 66);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
  pdf.text(plan.nombre_alumno, margen, 48);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
  pdf.text([plan.licenciatura, plan.grado_turno].filter(Boolean).join('  ·  '), margen, 55);
  let y = 68;
  pdf.setFillColor(231, 237, 244); pdf.rect(margen, y - 5, 182, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.text('N.º', margen + 3, y);
  pdf.text('CONCEPTO', margen + 18, y);
  pdf.text('VENCIMIENTO', margen + 128, y);
  pdf.text('IMPORTE', margen + 179, y, { align: 'right' });
  y += 10;
  pdf.setFont('helvetica', 'normal');
  filas.forEach((fila, indice) => {
    if (indice % 2 === 1) { pdf.setFillColor(247, 249, 252); pdf.rect(margen, y - 5.5, 182, 8, 'F'); }
    pdf.text(String(fila.numero), margen + 3, y);
    const concepto = pdf.splitTextToSize(fila.concepto, 102) as string[];
    pdf.text(concepto.slice(0, 1), margen + 18, y);
    pdf.text(fechaLocal(fila.fecha), margen + 128, y);
    pdf.text(moneda(fila.cantidad), margen + 179, y, { align: 'right' });
    y += 9;
  });
  pdf.setDrawColor(180, 192, 204); pdf.line(margen, y, 199, y);
  pdf.setFont('helvetica', 'bold'); pdf.text('TOTAL PROGRAMADO', margen + 3, y + 8);
  pdf.text(moneda(filas.reduce((total, fila) => total + fila.cantidad, 0)), margen + 179, y + 8, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  pdf.text('Documento informativo de vencimientos. No acredita pagos ni indica el saldo actual.', margen, 264);
  return pdf;
}
