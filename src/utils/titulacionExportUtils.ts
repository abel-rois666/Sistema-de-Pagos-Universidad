import { saveAs } from 'file-saver';
import type { AppConfig, Empleado } from '../types';
import { crearLibroLayoutTitulacion, prepararDatosLayoutTitulacion, type TitulacionAlumnoData } from '../titulacion/layoutTitulacion';
export { esModalidadExamen, generateFolioControl, ENTIDADES_CATALOGO, TIPOS_ANTECEDENTE_CATALOGO, prepararDatosLayoutTitulacion } from '../titulacion/layoutTitulacion';
export type { TitulacionAlumnoData } from '../titulacion/layoutTitulacion';

export async function generarLayoutTitulacionDGAIR(alumnosData:TitulacionAlumnoData[], config:AppConfig, firmante1:Empleado, firmante2?:Empleado|null) {
  // La misma validación se aplica aunque se invoque la descarga fuera del asistente.
  prepararDatosLayoutTitulacion(alumnosData,config,firmante1,firmante2);
  const response=await fetch('/Layout Títulos_v6_EJEMPLO.xlsx');
  if(!response.ok)throw new Error('No se pudo descargar la plantilla de títulos.');
  const workbook=await crearLibroLayoutTitulacion(await response.arrayBuffer(),alumnosData,config,firmante1,firmante2);
  const buffer=await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`LAYOUT_TITULACION_DGAIR_${Date.now()}.xlsx`);
}