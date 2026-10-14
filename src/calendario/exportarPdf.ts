import { jsPDF } from 'jspdf';
import { actividadesCalendario, type ActividadCalendario } from './actividades';
import { mesesInvolucrados } from './meses';
import type { CalendarioAcademico, EventoAcademico } from './service';

export type VariantePdfCalendario = 'completo' | 'actividades';

interface PlanPdf { id: string; nombre: string; clave_legado: string; carreras?: { nombre: string } | null }
export interface DatosPdfCalendario {
  calendario: CalendarioAcademico;
  cicloNombre: string;
  eventos: readonly EventoAcademico[];
  planes: readonly PlanPdf[];
}

const MARGEN = 11;
const LIMITE_Y = 275;
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function rgb(hex: string): [number, number, number] {
  const valor = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#2563eb';
  return [1, 3, 5].map(posicion => Number.parseInt(valor.slice(posicion, posicion + 2), 16)) as [number, number, number];
}

function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return fecha;
  const nombreMes = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(anio, mes - 1, dia))).replace('.', '');
  return `${dia} ${nombreMes} ${anio}`;
}

function fechaActividad(actividad: ActividadCalendario): string {
  return actividad.fecha_inicio === actividad.fecha_fin ? fechaCorta(actividad.fecha_inicio)
    : `${fechaCorta(actividad.fecha_inicio)} a ${fechaCorta(actividad.fecha_fin)}`;
}

function encabezado(pdf: jsPDF, datos: DatosPdfCalendario, variante: VariantePdfCalendario): void {
  const ancho = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(20, 40, 62);
  pdf.rect(0, 0, ancho, 34, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
  pdf.text(variante === 'completo' ? 'CALENDARIO ESCOLAR' : 'ACTIVIDADES DEL CALENDARIO', MARGEN, 11);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
  const nombre = pdf.splitTextToSize(datos.calendario.nombre, ancho - MARGEN * 2) as string[];
  pdf.text(nombre.slice(0, 2), MARGEN, 17);
  pdf.setFontSize(7.5);
  pdf.text(`${datos.cicloNombre}  |  ${datos.calendario.tipo_periodo}  |  ${datos.calendario.modalidad}`, MARGEN, 27);
  pdf.text(`Turnos: ${datos.calendario.turnos.join(', ')}  |  Clases: ${fechaCorta(datos.calendario.fecha_inicio)} a ${fechaCorta(datos.calendario.fecha_fin)}`, MARGEN, 31);
  pdf.setTextColor(27, 43, 57);
}

function mesPdf(pdf: jsPDF, mes: string, y: number, actividades: readonly ActividadCalendario[]): void {
  const x = MARGEN;
  const ancho = 79;
  const celda = ancho / 7;
  const [anio, numero] = mes.split('-').map(Number);
  const titulo = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(anio, numero - 1, 1)));
  pdf.setFillColor(230, 237, 245);
  pdf.roundedRect(x, y, ancho, 5.5, 1, 1, 'F');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5);
  pdf.text(titulo.charAt(0).toUpperCase() + titulo.slice(1), x + 2, y + 3.8);
  pdf.setFontSize(6.8);
  DIAS.forEach((dia, indice) => pdf.text(dia, x + indice * celda + celda / 2, y + 9.1, { align: 'center' }));
  const desfase = (new Date(Date.UTC(anio, numero - 1, 1)).getUTCDay() + 6) % 7;
  const cantidad = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  for (let dia = 1; dia <= cantidad; dia++) {
    const indice = desfase + dia - 1;
    const fecha = `${mes}-${String(dia).padStart(2, '0')}`;
    const marcada = actividades.find(item => item.fecha_inicio <= fecha && fecha <= item.fecha_fin);
    const cx = x + (indice % 7) * celda + celda / 2;
    const cy = y + 13 + Math.floor(indice / 7) * 4.1;
    if (marcada) {
      const color = rgb(marcada.color);
      pdf.setFillColor(...color);
      pdf.roundedRect(cx - 4.3, cy - 3.1, 8.6, 3.7, 0.8, 0.8, 'F');
      const luminosidad = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
      pdf.setTextColor(luminosidad > 175 ? 24 : 255, luminosidad > 175 ? 36 : 255, luminosidad > 175 ? 48 : 255);
    } else pdf.setTextColor(45, 57, 68);
    pdf.setFont('helvetica', marcada ? 'bold' : 'normal'); pdf.setFontSize(6.6);
    pdf.text(String(dia), cx, cy, { align: 'center' });
  }
  pdf.setTextColor(27, 43, 57);
}

function tituloSeccion(pdf: jsPDF, texto: string, x: number, y: number, ancho: number): number {
  pdf.setFillColor(230, 237, 245);
  pdf.roundedRect(x, y, ancho, 6, 1, 1, 'F');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5);
  pdf.setTextColor(27, 43, 57);
  pdf.text(texto, x + 2, y + 4);
  return y + 8;
}

function filaActividad(pdf: jsPDF, actividad: ActividadCalendario, x: number, y: number,
  ancho: number, dibujar: boolean): number {
  const anchoFecha = ancho > 140 ? 40 : 38;
  pdf.setFontSize(7.5);
  const fechas = pdf.splitTextToSize(fechaActividad(actividad), anchoFecha - 3) as string[];
  const nombre = pdf.splitTextToSize(actividad.nombre, ancho - anchoFecha - 7) as string[];
  const alto = Math.max(fechas.length, nombre.length) * 3.7 + 4;
  if (dibujar) {
    pdf.setFillColor(...rgb(actividad.color)); pdf.rect(x, y + 1, 1.8, alto - 2, 'F');
    pdf.setTextColor(55, 65, 75); pdf.setFont('helvetica', 'normal');
    pdf.text(fechas, x + 4, y + 3.5, { lineHeightFactor: 1.05 });
    pdf.setTextColor(27, 43, 57); pdf.setFont('helvetica', 'bold');
    pdf.text(nombre, x + anchoFecha + 2, y + 3.5, { lineHeightFactor: 1.05 });
    pdf.setDrawColor(220, 226, 231); pdf.line(x, y + alto, x + ancho, y + alto);
  }
  return alto;
}

function planesAsociados(datos: DatosPdfCalendario): PlanPdf[] {
  return datos.planes.filter(plan => datos.calendario.plan_ids.includes(plan.id))
    .sort((a, b) => (a.carreras?.nombre || a.nombre).localeCompare(b.carreras?.nombre || b.nombre, 'es'));
}

function completarPies(pdf: jsPDF): void {
  const total = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    pdf.setPage(pagina); pdf.setDrawColor(215, 222, 230); pdf.line(MARGEN, 282, 210 - MARGEN, 282);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 113, 125);
    pdf.text(`Página ${pagina} de ${total}`, 210 - MARGEN, 287, { align: 'right' });
  }
}

export function crearPdfCalendario(datos: DatosPdfCalendario, variante: VariantePdfCalendario): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const actividades = actividadesCalendario(datos.calendario.fecha_inicio, datos.calendario.fecha_fin, datos.eventos);
  const meses = variante === 'completo' ? mesesInvolucrados(datos.calendario.fecha_inicio,
    datos.calendario.fecha_fin, datos.eventos) : [];
  const planes = variante === 'completo' ? planesAsociados(datos) : [];
  let indiceMes = 0;
  let indiceActividad = 0;
  let indicePlan = 0;
  let primeraPagina = true;
  do {
    if (!primeraPagina) pdf.addPage();
    primeraPagina = false;
    encabezado(pdf, datos, variante);
    if (variante === 'completo') {
      let yMes = 40;
      while (indiceMes < meses.length && yMes + 38 <= LIMITE_Y) {
        mesPdf(pdf, meses[indiceMes], yMes, actividades);
        indiceMes++; yMes += 39;
      }
    }
    const x = variante === 'completo' ? 98 : MARGEN;
    const ancho = variante === 'completo' ? 101 : 210 - MARGEN * 2;
    let y = indiceActividad < actividades.length || variante === 'actividades'
      ? tituloSeccion(pdf, 'ACTIVIDADES', x, 40, ancho) : 40;
    while (indiceActividad < actividades.length) {
      const alto = filaActividad(pdf, actividades[indiceActividad], x, y, ancho, false);
      if (y + alto > LIMITE_Y && y > 48) break;
      filaActividad(pdf, actividades[indiceActividad], x, y, ancho, true);
      indiceActividad++; y += alto;
    }
    if (variante === 'completo' && indiceActividad === actividades.length && indicePlan < planes.length) {
      if (y + 14 <= LIMITE_Y) {
        y = tituloSeccion(pdf, 'PLANES ASOCIADOS', x, y + 5, ancho);
        while (indicePlan < planes.length) {
          const plan = planes[indicePlan];
          const texto = `${plan.carreras?.nombre || plan.nombre}  ·  ${plan.clave_legado || 'Sin clave'}`;
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.2);
          const lineas = pdf.splitTextToSize(texto, ancho - 4) as string[];
          const alto = lineas.length * 3.5 + 2;
          if (y + alto > LIMITE_Y) break;
          pdf.text(lineas, x + 2, y + 3);
          y += alto; indicePlan++;
        }
      }
    }
  } while (indiceMes < meses.length || indiceActividad < actividades.length || indicePlan < planes.length);
  completarPies(pdf);
  return pdf;
}
