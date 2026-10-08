import ExcelJS from 'exceljs';
import { encabezadosDias, seccionesCuadriculaHorario, type VistaHorario } from './cuadricula';
import type { EntradaHorario, SesionHorario } from './types';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const borde = { style: 'thin' as const, color: { argb: 'FF64748B' } };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };
const relleno = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

function nombreHoja(titulo: string, indice: number): string {
  const prefijo = `${String(indice + 1).padStart(2, '0')}-`;
  const limpio = titulo.replace(/[\[\]:*?/\\\x00-\x1f]/g, '').replace(/^'+|'+$/g, '').trim() || 'Horario';
  return `${prefijo}${limpio.slice(0, 31 - prefijo.length)}`;
}

/** Exporta exactamente las secciones docentes o vacantes visibles, una por hoja. */
export async function crearXlsxHorario(
  entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, vista: VistaHorario,
): Promise<Blob> {
  if (vista.tipo !== 'docentes') throw new Error('Excel está disponible para docentes y vacantes.');
  const secciones = seccionesCuadriculaHorario(entrada, sesiones, cicloNombre, vista);
  if (!secciones.length) throw new Error('Selecciona al menos un docente o vacante para exportar.');

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema de Control de Pagos';
  secciones.forEach((seccion, indice) => {
    const hoja = libro.addWorksheet(nombreHoja(seccion.titulo, indice));
    hoja.columns = [{ width: 20 }, ...seccion.dias.map(() => ({ width: 28 }))];
    const columnas = seccion.dias.length + 1;

    seccion.encabezado.forEach((linea, posicion) => {
      const fila = hoja.addRow([linea]);
      hoja.mergeCells(fila.number, 1, fila.number, columnas);
      const celda = fila.getCell(1);
      celda.font = { bold: posicion === 0, size: posicion === 0 ? 15 : 10,
        color: { argb: posicion === 0 ? 'FF0F172A' : 'FF334155' } };
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      fila.height = posicion === 0 ? 30 : 21;
    });
    hoja.addRow([]);

    const encabezado = hoja.addRow(encabezadosDias(seccion.dias));
    encabezado.height = 25;
    encabezado.eachCell(celda => {
      celda.font = { bold: true, color: { argb: 'FF0F172A' } };
      celda.fill = relleno('FFD1D5DB');
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      celda.border = bordes;
    });
    hoja.views = [{ state: 'frozen', xSplit: 1, ySplit: encabezado.number }];

    seccion.filas.forEach((datos, filaIndice) => {
      const fila = hoja.addRow(datos);
      fila.height = 43;
      fila.eachCell({ includeEmpty: true }, (celda, columna) => {
        celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        celda.border = bordes;
        if (columna === 1) celda.font = { bold: true };
        else if (seccion.noDisponibles[filaIndice]?.[columna - 2]) celda.fill = relleno('FFBEC2C7');
      });
    });
    const total = hoja.addRow(['HORAS POR DÍA', ...seccion.totalesDiarios]);
    total.eachCell(celda => {
      celda.font = { bold: true };
      celda.fill = relleno('FFE2E8F0');
      celda.alignment = { horizontal: 'center', vertical: 'middle' };
      celda.border = bordes;
    });

    hoja.addRow([]);
    const tituloMaterias = hoja.addRow(['Materias y grupos']);
    hoja.mergeCells(tituloMaterias.number, 1, tituloMaterias.number, columnas);
    tituloMaterias.getCell(1).font = { bold: true, size: 12 };
    const encabezadoMaterias = hoja.addRow(['CLAVE', 'HORAS PRES.', 'MATERIA', 'GRUPO']);
    encabezadoMaterias.eachCell(celda => {
      celda.font = { bold: true };
      celda.fill = relleno('FFD1D5DB');
      celda.border = bordes;
      celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    seccion.materias.forEach(materia => {
      const horas = Number(materia[1]);
      const fila = hoja.addRow([materia[0], Number.isFinite(horas) ? horas : materia[1], materia[2], materia[3]]);
      fila.height = 32;
      fila.eachCell(celda => {
        celda.border = bordes;
        celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
    });
    const totalMaterias = hoja.addRow(['TOTAL', seccion.totalesDiarios.reduce((a, b) => a + b, 0)]);
    totalMaterias.getCell(1).font = { bold: true };
    totalMaterias.getCell(2).font = { bold: true };

    if (seccion.asincronas.length) {
      hoja.addRow([]);
      const tituloAsincronas = hoja.addRow(['Trabajo asíncrono sin horario fijo']);
      hoja.mergeCells(tituloAsincronas.number, 1, tituloAsincronas.number, columnas);
      tituloAsincronas.getCell(1).font = { bold: true, size: 12 };
      const encabezadoAsincronas = hoja.addRow(['MATERIA', 'HORAS / SEMANA', 'GRUPO']);
      encabezadoAsincronas.eachCell(celda => {
        celda.font = { bold: true };
        celda.fill = relleno('FFD1D5DB');
        celda.border = bordes;
      });
      seccion.asincronas.forEach(datos => {
        const fila = hoja.addRow(datos);
        fila.eachCell(celda => { celda.border = bordes; celda.alignment = { wrapText: true }; });
      });
    }
  });
  const archivo = await libro.xlsx.writeBuffer();
  return new Blob([archivo], { type: TIPO_XLSX });
}
