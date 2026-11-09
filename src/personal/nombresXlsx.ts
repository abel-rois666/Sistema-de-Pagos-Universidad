import type { RevisionNombreDocente } from './types';
import { previsualizarNombresImportados } from './revisionNombres';
export async function exportarNombresXlsx(filas:RevisionNombreDocente[]) {
  const ExcelJS=await import('exceljs');const libro=new ExcelJS.Workbook(),hoja=libro.addWorksheet('Revisar nombres');
  hoja.addRow(['docente_id','clave','nombre_registrado','revision','primer_apellido','segundo_apellido','nombres']);
  filas.forEach(f=>hoja.addRow([f.docente_id,f.clave,f.nombre_historico,f.revision,f.apellido_paterno,f.apellido_materno,f.nombres]));
  hoja.columns.forEach((col,i)=>{col.width=[39,14,48,12,25,25,30][i];});hoja.getRow(1).font={bold:true};hoja.views=[{state:'frozen',ySplit:1}];
  const bytes=await libro.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;a.download='revision_nombres_docentes.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function leerNombresXlsx(archivo:File,actuales:RevisionNombreDocente[]) {
  if(!/\.xlsx$/i.test(archivo.name)||archivo.size>2*1024*1024)throw new Error('Usa una plantilla XLSX de hasta 2 MB.');
  const ExcelJS=await import('exceljs'),libro=new ExcelJS.Workbook();await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja=libro.getWorksheet('Revisar nombres');if(!hoja)throw new Error('No se encontró la hoja Revisar nombres.');
  if(hoja.rowCount>51)throw new Error('Importa como máximo 50 filas por revisión.');
  const filas:unknown[][]=[];
  hoja.eachRow({includeEmpty:true},row=>filas.push(Array.from({length:7},(_,i)=>row.getCell(i+1).value??'')));
  return previsualizarNombresImportados(filas,actuales);
}
