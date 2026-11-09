import { limpiarNombre,validarNombrePersonal,componerNombrePersonal } from './nombres';
import type { NombreDocentePendiente,RevisionNombreDocente } from './types';
export function iniciarRevisionNombre(fila:NombreDocentePendiente):RevisionNombreDocente {
  return {...fila,nombres:fila.datos.nombres||'',apellido_paterno:fila.datos.apellido_paterno||'',apellido_materno:fila.datos.apellido_materno||'',revisado:false};
}
export function validarLoteNombres(filas:RevisionNombreDocente[]):string[] {
  const errores:string[]=[];
  if(!filas.length||filas.length>50)errores.push('Selecciona entre 1 y 50 nombres revisados.');
  if(new Set(filas.map(f=>f.docente_id)).size!==filas.length)errores.push('Hay docentes repetidos.');
  for(const f of filas){
    if(!f.revisado)errores.push(`${f.clave}: falta confirmar la revisión.`);
    errores.push(...validarNombrePersonal({...f.datos,...f,nombre_completo:componerNombrePersonal(f)},f.datos,f.revisado).map(e=>`${f.clave}: ${e}`));
    if([f.nombres,f.apellido_paterno,f.apellido_materno].some(v=>limpiarNombre(v).length>150))errores.push(`${f.clave}: un nombre o apellido excede 150 caracteres.`);
  }
  return errores;
}
/** Importa propuestas de la página exportada, nunca confirma ni guarda por leer un archivo. */
export function previsualizarNombresImportados(filas:unknown[][],actuales:NombreDocentePendiente[]):{propuestas:RevisionNombreDocente[];errores:string[]} {
  const errores:string[]=[],propuestas:RevisionNombreDocente[]=[],ids=new Set<string>();
  const cabecera=['docente_id','clave','nombre_registrado','revision','primer_apellido','segundo_apellido','nombres'];
  if(JSON.stringify(filas[0])!==JSON.stringify(cabecera))return {propuestas,errores:['Usa la plantilla de revisión de nombres exportada por esta pantalla.']};
  const usadas=filas.slice(1).filter(f=>f.some(v=>v!==null&&v!==undefined&&v!==''));
  if(usadas.length>50)return {propuestas,errores:['Importa como máximo 50 filas por revisión.']};
  usadas.forEach((f,i)=>{
    if(f.slice(0,7).some(v=>v!==null&&v!==undefined&&!['string','number'].includes(typeof v))){errores.push(`Fila ${i+2}: se requiere texto simple, sin fórmulas.`);return;}
    const [id,clave,nombre,rev,paterno,materno,nombres]=f.map(v=>String(v??''));
    const actual=actuales.find(a=>a.docente_id===id);
    if(ids.has(id)){errores.push(`Fila ${i+2}: docente repetido.`);return;}ids.add(id);
    if(!actual||actual.clave!==clave||actual.nombre_historico!==nombre||String(actual.revision)!==rev){errores.push(`Fila ${i+2}: el registro no coincide con la página consultada o cambió desde la exportación.`);return;}
    if(![paterno,materno,nombres].some(v=>limpiarNombre(v)))return;
    const propuesta={...iniciarRevisionNombre(actual),apellido_paterno:limpiarNombre(paterno),apellido_materno:limpiarNombre(materno),nombres:limpiarNombre(nombres)};
    const e=validarLoteNombres([{...propuesta,revisado:true}]);
    if(e.length)errores.push(...e.map(e=>`Fila ${i+2}: ${e}`));else propuestas.push(propuesta);
  });
  return {propuestas,errores};
}
