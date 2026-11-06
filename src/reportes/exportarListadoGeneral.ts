import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Alumno } from '../types';
import { etiquetaColumnaListado,fechaLegibleListado,type ColumnaListado } from './listadoGeneral';

export function pdfListadoGeneral(alumnos:readonly Alumno[],columnas:readonly ColumnaListado[],fecha:string,filtros:string[]){
 const ancho=columnas.reduce((n,c)=>n+c.ancho,0),doc=new jsPDF({orientation:ancho>185?'landscape':'portrait',format:'a4'});
 let y=15;
 doc.setFontSize(15);doc.text('Listado General de Alumnos',14,y);y+=8;doc.setFontSize(9);
 for(const texto of [...filtros,`Alumnos: ${alumnos.length}`,columnas.some(c=>c.id==='edad')?`Edad calculada al ${fechaLegibleListado(fecha)}. Datos generales actuales.`:'Datos generales actuales.']){
  const lineas=doc.splitTextToSize(texto,doc.internal.pageSize.getWidth()-28);doc.text(lineas,14,y);y+=lineas.length*4.5;
 }
 autoTable(doc,{startY:y+3,columns:columnas.map(c=>({header:etiquetaColumnaListado(c,fecha),dataKey:c.id})),body:alumnos.map(a=>Object.fromEntries(columnas.map(c=>[c.id,c.valor(a,fecha)]))),
  theme:'grid',styles:{fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[20,86,240]},margin:{left:14,right:14,bottom:15},
  columnStyles:Object.fromEntries(columnas.map(c=>[c.id,{cellWidth:c.ancho}])),horizontalPageBreak:true,horizontalPageBreakRepeat:'nombre',horizontalPageBreakBehaviour:'afterAllRows',
  didDrawPage:()=>{doc.setFontSize(8);doc.setTextColor(90);doc.text(`Página ${doc.getCurrentPageInfo().pageNumber} · ${alumnos.length} alumnos`,14,doc.internal.pageSize.getHeight()-7);doc.setTextColor(0);}
 });
 return doc;
}
