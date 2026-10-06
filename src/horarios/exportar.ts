import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import JSZip from 'jszip';
import { horaTexto, NOMBRES_DIAS, type EntradaHorario, type SesionHorario } from './types';

export type VistaHorario = { tipo: 'grupos' | 'docentes'; id?: string };
type Seccion = { titulo: string; filas: string[][]; asincronas: string[][] };

function seccionesHorario(entrada: EntradaHorario, sesiones: SesionHorario[], vista: VistaHorario): Seccion[] {
  const grupos = new Map(entrada.grupos.map(g => [g.id, g]));
  const docentes = new Map(entrada.docentes.map(d => [d.id, d]));
  const cargas = new Map(entrada.cargas.map(c => [c.id, c]));
  const entidades = vista.tipo === 'grupos'
    ? entrada.grupos.map(g => ({ id: g.id, titulo: `Grupo ${g.codigo} · ${g.turno}` }))
    : entrada.docentes.filter(d => entrada.cargas.some(c => c.docenteId === d.id)).map(d => ({ id: d.id, titulo: `Docente ${d.nombre}` }));
  return entidades.filter(e => !vista.id || e.id === vista.id).map(entidad => {
    const esGrupo = vista.tipo === 'grupos';
    const filas = sesiones.filter(s => esGrupo ? s.grupoId === entidad.id : s.docenteId === entidad.id)
      .sort((a, b) => a.dia - b.dia || a.inicio - b.inicio || a.grupoId.localeCompare(b.grupoId))
      .map(s => [NOMBRES_DIAS[s.dia], `${horaTexto(s.inicio)}–${horaTexto(s.fin)}`,
        cargas.get(s.cargaId)?.asignatura || 'Asignatura', grupos.get(s.grupoId)?.codigo || 'Grupo',
        docentes.get(s.docenteId)?.nombre || 'Docente', [s.sede, s.aula].filter(Boolean).join(' / ') || '—']);
    const asincronas = entrada.cargas.filter(c => (esGrupo ? c.grupoId === entidad.id : c.docenteId === entidad.id) && (c.horasAsincronas || 0) > 0)
      .map(c => [c.asignatura, grupos.get(c.grupoId)?.codigo || 'Grupo', docentes.get(c.docenteId || '')?.nombre || 'Docente', `${c.horasAsincronas} h/semana`]);
    return { titulo: entidad.titulo, filas, asincronas };
  });
}

export function crearPdfHorario(entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, vista: VistaHorario): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape' });
  const secciones = seccionesHorario(entrada, sesiones, vista);
  secciones.forEach((seccion, indice) => {
    if (indice) pdf.addPage();
    pdf.setFillColor(20, 86, 240); pdf.rect(0, 0, 297, 15, 'F');
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(13); pdf.text('Horario académico', 12, 10);
    pdf.setTextColor(30, 41, 59); pdf.setFontSize(10); pdf.text(cicloNombre, 12, 23);
    pdf.setFontSize(14); pdf.text(seccion.titulo, 12, 32);
    autoTable(pdf, { startY: 37, head: [['Día', 'Horario', 'Asignatura', 'Grupo', 'Docente', 'Sede / aula']],
      body: seccion.filas.length ? seccion.filas : [['—', 'Sin sesiones presenciales', '—', '—', '—', '—']],
      theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [26, 43, 69] },
      margin: { left: 12, right: 12 }, didDrawPage: () => {},
    });
    if (seccion.asincronas.length) {
      let y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 45;
      if (y > 175) { pdf.addPage(); y = 12; }
      pdf.setFontSize(10); pdf.text('Trabajo asíncrono (sin horario fijo)', 12, y + 9);
      autoTable(pdf, { startY: y + 12, head: [['Asignatura', 'Grupo', 'Docente', 'Horas']],
        body: seccion.asincronas, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [35, 94, 82] }, margin: { left: 12, right: 12 } });
    }
  });
  if (!secciones.length) pdf.text('No hay grupos o docentes con carga para esta selección.', 12, 20);
  return pdf;
}

const xmlEscape = (valor: string) => valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const parrafo = (texto: string, negrita = false) => `<w:p><w:r>${negrita ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlEscape(texto)}</w:t></w:r></w:p>`;
const celda = (texto: string) => `<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${parrafo(texto)}</w:tc>`;
const tabla = (filas: string[][]) => `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${filas.map(fila => `<w:tr>${fila.map(celda).join('')}</w:tr>`).join('')}</w:tbl>`;

export async function crearDocxHorario(entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, vista: VistaHorario): Promise<Blob> {
  const zip = new JSZip();
  const secciones = seccionesHorario(entrada, sesiones, vista);
  const cuerpo = [parrafo('Horario académico', true), parrafo(cicloNombre), ...secciones.flatMap(s => [
    parrafo(s.titulo, true), tabla([['Día', 'Horario', 'Asignatura', 'Grupo', 'Docente', 'Sede / aula'], ...s.filas]),
    ...(s.asincronas.length ? [parrafo('Trabajo asíncrono (sin horario fijo)', true), tabla([['Asignatura', 'Grupo', 'Docente', 'Horas'], ...s.asincronas])] : []),
    parrafo(''),
  ])].join('');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
