import type { CandidatoInscripcion, CapturaInscripcion, InscripcionCiclo, SituacionInscripcion } from './types';

export function fechaInstitucionalInscripciones(ahora=new Date()): string {
  const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(ahora);
  return ['year','month','day'].map(k=>partes.find(p=>p.type===k)!.value).join('-');
}
export function esFechaInscripcion(v:string):boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
}
export function vigenteEnFecha(i:InscripcionCiclo,fecha:string):boolean {
  return i.estado!=='CANCELADA'&&i.desde<=fecha&&(!i.hasta||i.hasta>=fecha);
}
export function situacionInscripcion(c:CandidatoInscripcion,fecha:string):SituacionInscripcion {
  const i=c.inscripcion;
  if(!i)return 'PENDIENTE';
  if(i.estado==='CANCELADA')return 'CANCELADA';
  // Una baja posterior no borra la inscripción en fechas anteriores.
  if(vigenteEnFecha(i,fecha))return c.grupos.length?'CON_GRUPO':'SIN_GRUPO';
  if(i.estado==='BAJA'&&i.hasta&&i.hasta<fecha)return 'BAJA';
  return 'FUERA_FECHA';
}
export function capturaInicial(c:CandidatoInscripcion):CapturaInscripcion {
  const i=c.inscripcion;
  return {estado:i?.estado||'CONFIRMADA',desde:i?.desde||'',hasta:i?.hasta||'',
    grado_personal:i?.grado_personal||c.grado_sugerido||'',tipo_ingreso:i?.tipo_ingreso||'DESCONOCIDO',
    fecha_primer_ingreso:c.ingreso_programa?.fecha||i?.fecha_primer_ingreso||'',evidencia:i?.evidencia||'',motivo:'',admitir_historico:false,
    ciclo_origen_id:c.contexto_actual?.ciclo_origen_id||''};
}
/** El ciclo de ingreso actual es el destino; primer ingreso no requiere ciclo previo. */
export function normalizarOrigenInscripcion(v:CapturaInscripcion):CapturaInscripcion {
  return {...v,ciclo_origen_id:v.tipo_ingreso==='PRIMER_INGRESO'||v.ciclo_origen_id==='__NINGUNO__'?'':v.ciclo_origen_id};
}
export function validarCapturaInscripcion(c:CandidatoInscripcion,v:CapturaInscripcion,cicloId?:string):string[] {
  const errores:string[]=[];
  if(!c.compatible)errores.push('El programa y el ciclo tienen periodicidades distintas.');
  if(!esFechaInscripcion(v.desde))errores.push('Registra la fecha efectiva de inscripción.');
  if(v.hasta&&(!esFechaInscripcion(v.hasta)||v.hasta<v.desde))errores.push('El último día inscrito debe ser igual o posterior al inicio.');
  if(v.estado==='BAJA'&&!v.hasta)errores.push('La baja requiere el último día en que estuvo inscrito.');
  const grado=v.grado_personal.trim().toUpperCase().match(/^(\d+)(?:ER|RO|DO|TO|VO|MO|NO|º|°)?$/);
  if(!grado||Number(grado[1])<1||c.total_periodos!=null&&Number(grado[1])>c.total_periodos)errores.push('El grado personal debe pertenecer a la duración del plan.');
  if(v.tipo_ingreso==='PRIMER_INGRESO'&&!v.fecha_primer_ingreso&&!(c.ingreso_programa?.ciclo_id===cicloId&&cicloId&&['DOCUMENTADA','APROXIMADA'].includes(c.ingreso_programa.calidad)))errores.push('Acredita el ciclo de ingreso desde la ficha o registra la fecha histórica de inicio en el programa.');
  if(v.fecha_primer_ingreso&&(!esFechaInscripcion(v.fecha_primer_ingreso)||(esFechaInscripcion(v.desde)&&v.fecha_primer_ingreso>v.desde)))errores.push('El primer ingreso no puede ser posterior a esta inscripción.');
  if(v.evidencia.trim().length<5)errores.push('Identifica el documento o acto administrativo que acredita la inscripción.');
  if(v.motivo.trim().length<10)errores.push('Explica el motivo de la confirmación o corrección (mínimo 10 caracteres).');
  if(c.historico&&(!v.admitir_historico||v.motivo.trim().length<20))errores.push('El programa no está vigente o cursable: confirma la revisión histórica y explica al menos 20 caracteres.');
  return errores;
}
export function filtrarInscripciones(filas:CandidatoInscripcion[],busqueda:string,planId:string,situacion:string,fecha:string):CandidatoInscripcion[] {
  const q=busqueda.trim().toLocaleLowerCase('es');
  return filas.filter(c=>(!q||`${c.matricula} ${c.nombre} ${c.programa}`.toLocaleLowerCase('es').includes(q))
    &&(!planId||c.plan_id===planId)&&(!situacion||situacionInscripcion(c,fecha)===situacion))
    .sort((a,b)=>a.nombre.localeCompare(b.nombre,'es',{numeric:true})||a.programa.localeCompare(b.programa,'es')||a.alumno_programa_id.localeCompare(b.alumno_programa_id));
}
export function seleccionarPaginaInscripciones(seleccion:string[],visibles:CandidatoInscripcion[],marcar:boolean):string[] {
  const ids=new Set(visibles.map(c=>c.alumno_programa_id));
  return marcar?[...new Set([...seleccion,...ids])]:seleccion.filter(id=>!ids.has(id));
}
