import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import JSZip from 'jszip';
import { encabezadosDias, OPCIONES_PRESENTACION_PREDETERMINADAS, seccionesCuadriculaHorario,
  tablaMateriasHorario, type OpcionesPresentacionHorario, type VistaHorario } from './cuadricula';
import type { SeccionCuadriculaHorario } from './cuadricula';
import type { EntradaHorario, SesionHorario } from './types';

export type { VistaHorario } from './cuadricula';

export function crearPdfHorario(entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string,
  vista: VistaHorario, opciones: OpcionesPresentacionHorario = OPCIONES_PRESENTACION_PREDETERMINADAS): jsPDF {
  return crearPdfSecciones(seccionesCuadriculaHorario(entrada, sesiones, cicloNombre, vista), vista.tipo, opciones);
}

function crearPdfSecciones(secciones: SeccionCuadriculaHorario[], tipo: VistaHorario['tipo'],
  opciones: OpcionesPresentacionHorario): jsPDF {
  const orientacion = tipo === 'grupos' ? 'landscape' : 'portrait';
  const disenos = secciones.map(seccion => elegirDisenoPdf(seccion, tipo, opciones));
  const pdf = new jsPDF({ orientation: orientacion, format: disenos[0]?.formato || 'a4' });
  secciones.forEach((seccion, indice) => {
    const diseno = disenos[indice];
    if (indice) pdf.addPage(diseno.formato, orientacion);
    dibujarSeccionPdf(pdf, seccion, tipo, opciones, diseno.escala);
  });
  if (!secciones.length) pdf.text('No hay grupos o docentes seleccionados.', 10, 15);
  return pdf;
}

type DisenoPdf = { formato: 'a4' | 'a3'; escala: number };
const ultimaY = (pdf: jsPDF, reserva: number) =>
  ((pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0) + reserva;

/** Mide el contenido completo antes de dibujarlo: una sección nunca se parte entre páginas. */
function elegirDisenoPdf(seccion: SeccionCuadriculaHorario, tipo: VistaHorario['tipo'],
  opciones: OpcionesPresentacionHorario): DisenoPdf {
  const orientacion = tipo === 'grupos' ? 'landscape' : 'portrait';
  for (const formato of ['a4', 'a3'] as const) {
    for (const escala of formato === 'a4' ? [1, 0.9, 0.8, 0.7] : [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
      const prueba = new jsPDF({ orientation: orientacion, format: formato });
      const finalY = dibujarSeccionPdf(prueba, seccion, tipo, opciones, escala);
      if (prueba.getNumberOfPages() === 1 && finalY <= prueba.internal.pageSize.getHeight() - 7)
        return { formato, escala };
    }
  }
  throw new Error(`El horario de ${seccion.titulo} contiene demasiado texto para caber en una hoja. Oculta el cuadro asíncrono o reduce el contenido.`);
}

function dibujarSeccionPdf(pdf: jsPDF, seccion: SeccionCuadriculaHorario,
  tipo: VistaHorario['tipo'], opciones: OpcionesPresentacionHorario, escala: number): number {
  const detalle = tablaMateriasHorario(seccion, tipo, opciones);
  const anchoPagina = pdf.internal.pageSize.getWidth();
  const margen = 8;
  const anchoTabla = anchoPagina - margen * 2;
  let y = 12;
  pdf.setTextColor(20, 20, 20);
  seccion.encabezado.forEach((linea, posicion) => {
    pdf.setFont('helvetica', posicion === 0 ? 'bold' : 'normal');
    pdf.setFontSize((posicion === 0 ? 12 : 9) * escala);
    const lineas = pdf.splitTextToSize(linea, anchoTabla) as string[];
    pdf.text(lineas, anchoPagina / 2, y, { align: 'center', lineHeightFactor: 1.05 });
    y += (posicion === 0 ? 5.5 : 4.2) * escala * lineas.length;
  });
  const estilo = { fontSize: 8.5 * escala, cellPadding: 1.5 * escala, halign: 'center' as const,
    valign: 'middle' as const, lineColor: [65, 65, 65] as [number, number, number], lineWidth: 0.12 };
  const cabecera = { fillColor: [190, 194, 199] as [number, number, number],
    textColor: [15, 23, 42] as [number, number, number], fontStyle: 'bold' as const };
  const anchoHora = tipo === 'grupos' && seccion.turno === 'MIXTO' ? 23 : 26;
  autoTable(pdf, { startY: y + 2 * escala, head: [encabezadosDias(seccion.dias)],
    body: tipo === 'docentes'
      ? [...seccion.filas, ['HORAS POR DÍA', ...seccion.totalesDiarios.map(String)]] : seccion.filas,
    theme: 'grid', styles: estilo, headStyles: cabecera,
    columnStyles: { 0: { cellWidth: anchoHora, fontStyle: 'bold' },
      ...Object.fromEntries(seccion.dias.map((_, indice) =>
        [indice + 1, { cellWidth: (anchoTabla - anchoHora) / seccion.dias.length }])) },
    margin: { left: margen, right: margen, top: margen, bottom: margen }, rowPageBreak: 'avoid',
    didParseCell: data => {
      if (data.section === 'body' && data.column.index > 0
        && seccion.noDisponibles[data.row.index]?.[data.column.index - 1]) {
        data.cell.styles.fillColor = [190, 194, 199];
      }
    },
  });
  y = ultimaY(pdf, 4 * escala);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5 * escala);
  pdf.text(tipo === 'grupos' ? 'Materias y docentes' : 'Materias y grupos', anchoPagina / 2, y, { align: 'center' });
  autoTable(pdf, { startY: y + 2 * escala, head: [detalle.encabezado],
    body: tipo === 'docentes'
      ? [...detalle.filas, ['TOTAL', String(seccion.totalesDiarios.reduce((a, b) => a + b, 0)), '', '']]
      : detalle.filas,
    theme: 'grid', styles: estilo, headStyles: cabecera,
    margin: { left: margen, right: margen, top: margen, bottom: margen }, rowPageBreak: 'avoid',
  });
  y = ultimaY(pdf, 0);
  if (opciones.mostrarAsincronas && seccion.asincronas.length) {
    y += 4 * escala;
    pdf.setFontSize(9.5 * escala); pdf.text('Trabajo asíncrono sin horario fijo', margen, y);
    autoTable(pdf, { startY: y + 2 * escala,
      head: [tipo === 'grupos' ? ['MATERIA', 'HORAS / SEMANA'] : ['MATERIA', 'HORAS / SEMANA', 'GRUPO']],
      body: seccion.asincronas, theme: 'grid', styles: estilo, headStyles: cabecera,
      margin: { left: margen, right: margen, top: margen, bottom: margen }, rowPageBreak: 'avoid' });
    y = ultimaY(pdf, 0);
  }
  return y;
}

/** Un PDF por sección seleccionada, dentro de una carpeta del archivo ZIP. */
export async function crearZipPdfHorarios(entrada: EntradaHorario, sesiones: SesionHorario[],
  cicloNombre: string, vista: VistaHorario,
  opciones: OpcionesPresentacionHorario = OPCIONES_PRESENTACION_PREDETERMINADAS): Promise<Blob> {
  const secciones = seccionesCuadriculaHorario(entrada, sesiones, cicloNombre, vista);
  if (!secciones.length) throw new Error('Selecciona al menos un horario para exportar.');
  const zip = new JSZip();
  const carpeta = zip.folder(vista.tipo === 'grupos' ? 'grupos' : 'docentes-y-vacantes')!;
  secciones.forEach((seccion, indice) => {
    const nombre = seccion.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'horario';
    const pdf = crearPdfSecciones([seccion], vista.tipo, opciones);
    carpeta.file(`${String(indice + 1).padStart(2, '0')}-${nombre}.pdf`, pdf.output('arraybuffer'));
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}

const xmlEscape = (valor: string) => valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const ANCHO_WORD = 10400;
const ANCHO_WORD_A3 = 15000;
const ANCHO_WORD_GRUPO = 15000;
const ANCHO_WORD_GRUPO_A3 = 22000;
const parrafo = (texto: string, negrita = false, centrado = false, puntos = 7) =>
  `<w:p><w:pPr>${centrado ? '<w:jc w:val="center"/>' : ''}<w:spacing w:before="0" w:after="0" w:line="${Math.round(puntos * 23)}" w:lineRule="exact"/></w:pPr><w:r><w:rPr>${negrita ? '<w:b/>' : ''}<w:sz w:val="${puntos * 2}"/></w:rPr>${texto.split('\n')
    .map((linea, indice) => `${indice ? '<w:br/>' : ''}<w:t xml:space="preserve">${xmlEscape(linea)}</w:t>`).join('')}</w:r></w:p>`;
const celda = (texto: string, encabezado: boolean, ancho: number, noDisponible = false, puntos = 6.5) =>
  `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/><w:tcMar><w:top w:w="28" w:type="dxa"/><w:bottom w:w="28" w:type="dxa"/><w:left w:w="28" w:type="dxa"/><w:right w:w="28" w:type="dxa"/></w:tcMar>${encabezado || noDisponible ? '<w:shd w:fill="BEC2C7"/>' : ''}</w:tcPr>${parrafo(texto, encabezado, true, puntos)}</w:tc>`;
const tabla = (filas: string[][], noDisponibles: boolean[][] = [], puntos = 6.5,
  anchos?: number[], anchoTotal = ANCHO_WORD) => {
  const columnas = filas[0]?.length || 1;
  const anchuras = anchos || Array.from({ length: columnas }, (_, indice) =>
    indice === columnas - 1 ? anchoTotal - Math.floor(anchoTotal / columnas) * indice
      : Math.floor(anchoTotal / columnas));
  return `<w:tbl><w:tblPr><w:tblW w:w="${anchoTotal}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid>${anchuras.map(ancho => `<w:gridCol w:w="${ancho}"/>`).join('')}</w:tblGrid>${filas.map((fila, indice) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${fila.map((texto, columna) => celda(texto, indice === 0, anchuras[columna], noDisponibles[indice - 1]?.[columna - 1], puntos)).join('')}</w:tr>`).join('')}</w:tbl>`;
};

const anchosHorarioWord = (seccion: SeccionCuadriculaHorario, anchoTotal: number): number[] => {
  const primera = seccion.turno === 'MIXTO' && seccion.dias.length === 1 ? 1400 : anchoTotal === ANCHO_WORD ? 1500 : 1800;
  const restante = anchoTotal - primera;
  return [primera, ...seccion.dias.map((_, indice) => indice === seccion.dias.length - 1
    ? restante - Math.floor(restante / seccion.dias.length) * indice
    : Math.floor(restante / seccion.dias.length))];
};

const ajustarAnchosWord = (anchos: number[], anchoTotal: number) => {
  const escalados = anchos.map(ancho => Math.floor(ancho * anchoTotal / ANCHO_WORD));
  escalados[escalados.length - 1] += anchoTotal - escalados.reduce((suma, ancho) => suma + ancho, 0);
  return escalados;
};

const puntosTablaWord = (filas: number) => filas <= 36 ? 8 : filas <= 50 ? 7 : 6.5;

function estimarAlturaWord(seccion: SeccionCuadriculaHorario, tipo: VistaHorario['tipo'],
  opciones: OpcionesPresentacionHorario, anchoTotal: number): number {
  const detalle = tablaMateriasHorario(seccion, tipo, opciones);
  const filas = seccion.filas.length + detalle.filas.length
    + (opciones.mostrarAsincronas ? seccion.asincronas.length : 0);
  const puntos = puntosTablaWord(filas);
  const tablaAltura = (contenido: string[][], anchos: number[]) => contenido.reduce((total, fila) => {
    const lineas = Math.max(...fila.map((texto, indice) => texto.split('\n').reduce((cantidad, segmento) =>
      cantidad + Math.max(1, Math.ceil(segmento.length / Math.max(8, Math.floor(anchos[indice] / (puntos * 12))))), 0)));
    return total + lineas * puntos * 23 + 56;
  }, 0);
  const horario = tablaAltura([encabezadosDias(seccion.dias), ...seccion.filas,
    ...(tipo === 'docentes' ? [['HORAS POR DÍA', ...seccion.totalesDiarios.map(String)]] : [])],
  anchosHorarioWord(seccion, anchoTotal));
  const anchosDetalle = ajustarAnchosWord(detalle.encabezado.length === 4
    ? [1200, 900, 5800, 2500] : [1400, 6500, 2500], anchoTotal);
  const materias = tablaAltura([detalle.encabezado, ...detalle.filas,
    ...(tipo === 'docentes' ? [['TOTAL', '', '', '']] : [])], anchosDetalle);
  const asincronas = opciones.mostrarAsincronas && seccion.asincronas.length
    ? tablaAltura([tipo === 'grupos' ? ['MATERIA', 'HORAS / SEMANA'] : ['MATERIA', 'HORAS / SEMANA', 'GRUPO'],
      ...seccion.asincronas], ajustarAnchosWord(tipo === 'grupos'
      ? [7800, 2600] : [6500, 1500, 2400], anchoTotal)) + 180 : 0;
  return seccion.encabezado.length * 220 + horario + materias + asincronas + 800;
}

export async function crearDocxHorario(entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string,
  vista: VistaHorario, opciones: OpcionesPresentacionHorario = OPCIONES_PRESENTACION_PREDETERMINADAS): Promise<Blob> {
  const zip = new JSZip();
  const secciones = seccionesCuadriculaHorario(entrada, sesiones, cicloNombre, vista);
  const esGrupo = vista.tipo === 'grupos';
  const anchoA4 = esGrupo ? ANCHO_WORD_GRUPO : ANCHO_WORD;
  const limiteA4 = esGrupo ? 10000 : 15000;
  const usarA3 = secciones.some(seccion => estimarAlturaWord(seccion, vista.tipo, opciones, anchoA4) > limiteA4);
  const anchoWord = usarA3 ? (esGrupo ? ANCHO_WORD_GRUPO_A3 : ANCHO_WORD_A3) : anchoA4;
  if (secciones.some(seccion => estimarAlturaWord(seccion, vista.tipo, opciones, anchoWord)
    > (usarA3 ? (esGrupo ? 15000 : 22000) : limiteA4))) {
    throw new Error('Uno de los horarios contiene demasiado texto para caber en una hoja de Word. Oculta el cuadro asíncrono o reduce el contenido.');
  }
  const cuerpo = secciones.flatMap((seccion, indice) => {
    const detalle = tablaMateriasHorario(seccion, vista.tipo, opciones);
    const filasTotales = seccion.filas.length + detalle.filas.length
      + (opciones.mostrarAsincronas ? seccion.asincronas.length : 0);
    const puntosTabla = puntosTablaWord(filasTotales);
    return [
    ...(indice ? ['<w:p><w:r><w:br w:type="page"/></w:r></w:p>'] : []),
    ...seccion.encabezado.map((linea, posicion) => parrafo(linea, posicion === 0, true, posicion === 0 ? 9 : 7)),
    tabla([encabezadosDias(seccion.dias), ...seccion.filas,
      ...(vista.tipo === 'docentes' ? [['HORAS POR DÍA', ...seccion.totalesDiarios.map(String)]] : [])],
    seccion.noDisponibles, puntosTabla, anchosHorarioWord(seccion, anchoWord), anchoWord),
    parrafo(vista.tipo === 'grupos' ? 'Materias y docentes' : 'Materias y grupos', true, true, 7),
    tabla([detalle.encabezado, ...detalle.filas,
      ...(vista.tipo === 'docentes' ? [['TOTAL', String(seccion.totalesDiarios.reduce((a, b) => a + b, 0)), '', '']] : [])],
    [], puntosTabla, ajustarAnchosWord(detalle.encabezado.length === 4
      ? [1200, 900, 5800, 2500] : [1400, 6500, 2500], anchoWord), anchoWord),
    ...(opciones.mostrarAsincronas && seccion.asincronas.length ? [parrafo('Trabajo asíncrono sin horario fijo', true, false, 7),
      tabla([vista.tipo === 'grupos' ? ['MATERIA', 'HORAS / SEMANA'] : ['MATERIA', 'HORAS / SEMANA', 'GRUPO'],
        ...seccion.asincronas], [], puntosTabla, ajustarAnchosWord(vista.tipo === 'grupos'
        ? [7800, 2600] : [6500, 1500, 2400], anchoWord), anchoWord)] : []),
  ]; }).join('') || parrafo('No hay grupos o docentes seleccionados.');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const anchoPagina = esGrupo ? (usarA3 ? 23811 : 16838) : (usarA3 ? 16838 : 11906);
  const altoPagina = esGrupo ? (usarA3 ? 16838 : 11906) : (usarA3 ? 23811 : 16838);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="${anchoPagina}" w:h="${altoPagina}" w:orient="${esGrupo ? 'landscape' : 'portrait'}"/><w:pgMar w:top="420" w:right="600" w:bottom="420" w:left="600"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
