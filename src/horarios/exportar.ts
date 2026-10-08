import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import JSZip from 'jszip';
import { encabezadosDias, seccionesCuadriculaHorario, type VistaHorario } from './cuadricula';
import type { EntradaHorario, SesionHorario } from './types';

export type { VistaHorario } from './cuadricula';

export function crearPdfHorario(entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, vista: VistaHorario): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const secciones = seccionesCuadriculaHorario(entrada, sesiones, cicloNombre, vista);
  secciones.forEach((seccion, indice) => {
    if (indice) pdf.addPage();
    let y = 17;
    pdf.setTextColor(20, 20, 20);
    seccion.encabezado.forEach((linea, posicion) => {
      pdf.setFont('helvetica', posicion === 0 ? 'bold' : 'normal');
      pdf.setFontSize(posicion === 0 ? 12 : 9);
      const lineas = pdf.splitTextToSize(linea, 265) as string[];
      pdf.text(lineas, 148.5, y, { align: 'center' });
      y += (posicion === 0 ? 7 : 5) * lineas.length;
    });
    autoTable(pdf, { startY: y + 3, head: [encabezadosDias(seccion.dias)],
      body: vista.tipo === 'docentes'
        ? [...seccion.filas, ['HORAS POR DÍA', ...seccion.totalesDiarios.map(String)]] : seccion.filas,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, halign: 'center', valign: 'middle', lineColor: [65, 65, 65], lineWidth: 0.15 },
      headStyles: { fillColor: [190, 194, 199], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' },
        ...Object.fromEntries(seccion.dias.map((_, indice) => [indice + 1, { cellWidth: 245 / seccion.dias.length }])) },
      margin: { left: 12, right: 12 },
      rowPageBreak: 'avoid',
      didParseCell: data => {
        if (data.section === 'body' && data.column.index > 0
          && seccion.noDisponibles[data.row.index]?.[data.column.index - 1]) {
          data.cell.styles.fillColor = [190, 194, 199];
        }
      },
    });
    let siguienteY = ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 10) + 10;
    if (siguienteY > 175) { pdf.addPage(); siguienteY = 16; }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
    pdf.text(vista.tipo === 'grupos' ? 'Materias y docentes' : 'Materias y grupos', 12, siguienteY);
    autoTable(pdf, { startY: siguienteY + 3,
      head: [vista.tipo === 'grupos'
        ? ['CLAVE', 'HORAS PRES.', 'MATERIA', 'DOCENTE']
        : ['CLAVE', 'HORAS PRES.', 'MATERIA', 'GRUPO']],
      body: vista.tipo === 'docentes'
        ? [...seccion.materias, ['TOTAL', String(seccion.totalesDiarios.reduce((a, b) => a + b, 0)), '', '']]
        : seccion.materias, theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, halign: 'center', valign: 'middle', lineColor: [65, 65, 65], lineWidth: 0.15 },
      headStyles: { fillColor: [190, 194, 199], textColor: [15, 23, 42], fontStyle: 'bold' },
      margin: { left: 12, right: 12 },
    });
    if (seccion.asincronas.length) {
      let asincronaY = ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || siguienteY + 10) + 10;
      if (asincronaY > 185) { pdf.addPage(); asincronaY = 16; }
      pdf.setFontSize(10); pdf.text('Trabajo asíncrono sin horario fijo', 12, asincronaY);
      autoTable(pdf, { startY: asincronaY + 3,
        head: [vista.tipo === 'grupos' ? ['MATERIA', 'HORAS / SEMANA'] : ['MATERIA', 'HORAS / SEMANA', 'GRUPO']],
        body: seccion.asincronas, theme: 'grid', styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [190, 194, 199], textColor: [15, 23, 42] }, margin: { left: 12, right: 12 } });
    }
  });
  if (!secciones.length) pdf.text('No hay grupos o docentes seleccionados.', 12, 20);
  return pdf;
}

const xmlEscape = (valor: string) => valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const parrafo = (texto: string, negrita = false, centrado = false, puntos?: number) =>
  `<w:p>${centrado ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ''}<w:r>${negrita || puntos ? `<w:rPr>${negrita ? '<w:b/>' : ''}${puntos ? `<w:sz w:val="${puntos * 2}"/>` : ''}</w:rPr>` : ''}${texto.split('\n')
    .map((linea, indice) => `${indice ? '<w:br/>' : ''}<w:t xml:space="preserve">${xmlEscape(linea)}</w:t>`).join('')}</w:r></w:p>`;
const celda = (texto: string, encabezado: boolean, ancho: number, noDisponible = false, puntos = 8) => `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${encabezado || noDisponible ? '<w:shd w:fill="BEC2C7"/>' : ''}</w:tcPr>${parrafo(texto, encabezado, true, puntos)}</w:tc>`;
const tabla = (filas: string[][], noDisponibles: boolean[][] = [], puntos = 8) => {
  const columnas = filas[0]?.length || 1;
  const ancho = Math.floor(14400 / columnas);
  return `<w:tbl><w:tblPr><w:tblW w:w="14400" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid>${Array.from({ length: columnas }, () => `<w:gridCol w:w="${ancho}"/>`).join('')}</w:tblGrid>${filas.map((fila, indice) => `<w:tr>${fila.map((texto, columna) => celda(texto, indice === 0, ancho, noDisponibles[indice - 1]?.[columna - 1], puntos)).join('')}</w:tr>`).join('')}</w:tbl>`;
};

export async function crearDocxHorario(entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, vista: VistaHorario): Promise<Blob> {
  const zip = new JSZip();
  const secciones = seccionesCuadriculaHorario(entrada, sesiones, cicloNombre, vista);
  const cuerpo = secciones.flatMap((seccion, indice) => [
    ...(indice ? ['<w:p><w:r><w:br w:type="page"/></w:r></w:p>'] : []),
    ...seccion.encabezado.map((linea, posicion) => parrafo(linea, posicion === 0, true)),
    parrafo(''),
    tabla([encabezadosDias(seccion.dias), ...seccion.filas,
      ...(vista.tipo === 'docentes' ? [['HORAS POR DÍA', ...seccion.totalesDiarios.map(String)]] : [])], seccion.noDisponibles, 7),
    parrafo(vista.tipo === 'grupos' ? 'Materias y docentes' : 'Materias y grupos', true),
    tabla([vista.tipo === 'grupos' ? ['CLAVE', 'HORAS PRES.', 'MATERIA', 'DOCENTE']
      : ['CLAVE', 'HORAS PRES.', 'MATERIA', 'GRUPO'], ...seccion.materias,
      ...(vista.tipo === 'docentes' ? [['TOTAL', String(seccion.totalesDiarios.reduce((a, b) => a + b, 0)), '', '']] : [])]),
    ...(seccion.asincronas.length ? [parrafo('Trabajo asíncrono sin horario fijo', true),
      tabla([vista.tipo === 'grupos' ? ['MATERIA', 'HORAS / SEMANA'] : ['MATERIA', 'HORAS / SEMANA', 'GRUPO'],
        ...seccion.asincronas])] : []),
  ]).join('') || parrafo('No hay grupos o docentes seleccionados.');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
