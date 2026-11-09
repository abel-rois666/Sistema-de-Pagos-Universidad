import { DOCUMENTOS_PERSONAL } from './documentos';
import type { DatosPersona,DocumentoPersonal,ExpedientePersonal,FormacionPersonal,VinculoLaboral } from './types';

export const ESTADOS_DOCUMENTO = ['SIN_REGISTRAR','PENDIENTE','ENTREGADO','REVISADO','NO_APLICA'] as const;
export const NIVELES_FORMACION = ['Licenciatura','Especialidad','Maestría','Doctorado','Otro'] as const;
export const SITUACIONES_FORMACION = ['En curso','Incompleto','Terminado','Titulado'] as const;
export const CONTRATACIONES_PERSONAL = ['Determinado','Honorarios','Indeterminado','Obra o Tiempo','Otro'] as const;
export function documentosIniciales(marcas:Record<string,boolean>={}):DocumentoPersonal[]{return DOCUMENTOS_PERSONAL.map(d=>({clave:d.key,requerido:false,estado:marcas[d.key]?'ENTREGADO':'SIN_REGISTRAR',motivo:'',referencia:''}));}
export function resumenExpediente(documentos:DocumentoPersonal[]) {
  const aplicables=documentos.filter(d=>d.requerido&&(d.estado!=='NO_APLICA'||d.motivo.trim().length<5));
  const entregados=aplicables.filter(d=>['ENTREGADO','REVISADO'].includes(d.estado)).length;
  return {requeridos:aplicables.length,entregados,revisados:aplicables.filter(d=>d.estado==='REVISADO').length,porcentaje:aplicables.length?Math.round(entregados/aplicables.length*100):null};
}
function fechaValida(v:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const f=new Date(`${v}T12:00:00`);return !Number.isNaN(+f)&&f.getFullYear()===Number(v.slice(0,4))&&f.getMonth()+1===Number(v.slice(5,7))&&f.getDate()===Number(v.slice(8,10));}
export function validarGenerales(d:DatosPersona):string[]{
  const rfc=d.rfc?.trim(),curp=d.curp?.trim(),email=d.email?.trim();
  const e:string[]=[];if(!d.nombre_completo.trim())e.push('Escribe el nombre completo.');
  if(rfc&&!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(rfc))e.push('Revisa el formato del RFC.');
  if(curp&&!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i.test(curp))e.push('Revisa el formato de la CURP.');
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))e.push('Revisa el correo electrónico.');
  if(d.fecha_nacimiento&&(!fechaValida(d.fecha_nacimiento)||d.fecha_nacimiento>new Date().toLocaleDateString('sv-SE')))e.push('La fecha de nacimiento debe ser válida y no futura.');
  if((d.nombres||d.apellido_paterno||d.apellido_materno)&&(!d.nombres?.trim()||!d.apellido_paterno?.trim()))e.push('Completa primer apellido y nombre(s). El segundo apellido es opcional.');
  return e;
}
export function validarLaborales(filas:VinculoLaboral[]):string[]{const e:string[]=[];for(const f of filas.filter(f=>!f.archivado)){
  if(!f.funcion.trim())e.push('Cada vínculo laboral necesita una función o puesto.');
  if((f.fecha_inicio&&!fechaValida(f.fecha_inicio))||(f.fecha_fin&&!fechaValida(f.fecha_fin)))e.push('Revisa las fechas del vínculo laboral.');
  if(f.fecha_inicio&&f.fecha_fin&&f.fecha_inicio>f.fecha_fin)e.push('El inicio del vínculo no puede ser posterior al término.');
  if(f.horas_contratadas!==null&&(!Number.isFinite(f.horas_contratadas)||f.horas_contratadas<0||f.horas_contratadas>168))e.push('Las horas contratadas deben estar entre 0 y 168.');
}return [...new Set(e)];}
export function validarFormacion(filas:FormacionPersonal[]):string[]{const e:string[]=[];const activas=filas.filter(f=>!f.archivado);if(activas.filter(f=>f.principal).length>1)e.push('Selecciona una sola formación principal.');
  for(const f of activas){if(!f.nivel||!f.programa.trim()||!f.situacion)e.push('Completa nivel, programa y situación de cada formación.');if(f.fecha_titulacion&&!fechaValida(f.fecha_titulacion))e.push('Revisa la fecha de titulación.');}return [...new Set(e)];}
export function validarExpediente(e:ExpedientePersonal):string[]{const errores:string[]=[];for(const d of e.documentos){if(!ESTADOS_DOCUMENTO.includes(d.estado))errores.push('Estado documental no reconocido.');if(d.estado==='NO_APLICA'&&d.motivo.trim().length<5)errores.push('Explica por qué no aplica cada documento señalado.');}
  if(e.enlace_drive){try{const u=new URL(e.enlace_drive);if(u.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(u.hostname))errores.push('Usa un enlace HTTPS de Google Drive o Google Docs.');}catch{errores.push('Revisa el enlace de la carpeta.');}}return [...new Set(errores)];}
