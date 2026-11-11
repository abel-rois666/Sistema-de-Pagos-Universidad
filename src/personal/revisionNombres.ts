import { limpiarNombre,validarNombrePersonal,componerNombrePersonal } from './nombres';
import type { NombreDocentePendiente,RevisionNombreDocente } from './types';
export function mensajeErrorRevisionNombres(error: unknown): string {
  const e = error as {code?:string;message?:string}|null;
  const mensaje = e?.message || '';
  if (/formato del RFC|formato de la CURP|correo electr[oó]nico/i.test(mensaje)) return 'La función instalada está validando datos fiscales o de contacto anteriores al revisar los nombres. Aplica la actualización de revisión nominal de Personal; no borres ni sustituyas esos datos para continuar. La captura se conserva.';
  if (e?.code === '40001') return 'Algún docente o expediente cambió desde la consulta. No se guardó el lote. Actualiza la consulta y vuelve a comprobar los nombres; tu captura se conserva.';
  if (['40P01','55P03'].includes(e?.code || '')) return 'Otro proceso está utilizando uno de los expedientes. No se guardó el lote. Espera a que termine y vuelve a revisar la consulta.';
  if (['PGRST202','42883'].includes(e?.code || '')) return 'La revisión de nombres no está disponible en el servidor. Instala la actualización de nombres de Personal. La captura se conserva.';
  if (e?.code === '42501') return 'Tu cuenta no tiene permiso para confirmar nombres de docentes. La captura se conserva.';
  if (/failed to fetch|network|timeout/i.test(mensaje)) return 'No se pudo confirmar la respuesta del servidor. Consulta si los nombres quedaron guardados antes de repetir el lote; la captura se conserva.';
  return mensaje || 'No se pudo confirmar el lote de nombres. La captura se conserva.';
}
export function iniciarRevisionNombre(fila:NombreDocentePendiente):RevisionNombreDocente {
  return {...fila,nombres:fila.datos.nombres||'',apellido_paterno:fila.datos.apellido_paterno||'',apellido_materno:fila.datos.apellido_materno||'',revisado:false};
}
/** Conserva las partes capturadas, pero renueva el testigo y exige revisar cualquier original cambiado. */
export function actualizarCapturasNombres(capturas: Record<string, RevisionNombreDocente>, nuevas: NombreDocentePendiente[]) {
  const resultado = { ...capturas };
  for (const fila of nuevas) {
    const captura = capturas[fila.docente_id];
    if (captura && (captura.revision !== fila.revision || JSON.stringify(captura.original) !== JSON.stringify(fila.original)))
      resultado[fila.docente_id] = { ...fila, nombres: captura.nombres, apellido_paterno: captura.apellido_paterno, apellido_materno: captura.apellido_materno, revisado: false };
  }
  return resultado;
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
