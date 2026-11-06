import type { CicloEscolar } from '../types';
import { esFechaInscripcion } from './dominio';
import type { CicloHistorialInscripcion, HistorialInscripcion } from './historial';
import type { CandidatoInscripcion, CapturaInscripcion, ReferenciaHistorialInscripcion } from './types';

export type DestinoFechaInscripcion=Pick<CicloEscolar,'id'|'nombre'|'tipo_periodo'|'fecha_inicio'>;
export type PropuestaFechaInscripcion={fecha:string|null;cicloFecha:CicloHistorialInscripcion|null;origen:CicloHistorialInscripcion|null;motivo:string;motivoOrigen:string;materias:number};
const periodo=(v:string)=>v.trim().toUpperCase();

/** Propone por separado inicio histórico y último ciclo anterior con calificaciones. */
export function proponerFechaInscripcion(c:CandidatoInscripcion,v:CapturaInscripcion,h:HistorialInscripcion,d?:DestinoFechaInscripcion):PropuestaFechaInscripcion {
  const no=(motivo:string):PropuestaFechaInscripcion=>({fecha:null,cicloFecha:null,origen:null,motivo,motivoOrigen:motivo,materias:0});
  if(!d?.fecha_inicio||!esFechaInscripcion(d.fecha_inicio))return no('El destino necesita una fecha de inicio válida para ordenar los antecedentes.');
  if(v.estado==='CANCELADA')return no('Una inscripción cancelada requiere revisión manual.');
  if(!c.compatible||periodo(c.tipo_periodo)!==periodo(d.tipo_periodo||''))return no('El programa y el destino tienen periodicidades distintas.');
  if(!h.huella||h.alumno_programa_id!==c.alumno_programa_id||h.alumno_id!==c.alumno_id||h.plan_id!==c.plan_id)return no('Falta una trayectoria verificable del mismo alumno, programa y plan.');
  const notas=h.ciclos.filter(x=>x.materias.length>0);
  if(!notas.length)return no('No hay materias con calificaciones en este programa; tener grupo no basta.');
  if(notas.some(x=>periodo(x.tipo_periodo)!==periodo(c.tipo_periodo)))return no('Hay calificaciones asociadas a otra periodicidad. Revisa sus ciclos.');
  if(notas.some(x=>!x.fecha_inicio||!esFechaInscripcion(x.fecha_inicio)||x.materias.some(m=>m.registros<1)))return no('Faltan fechas válidas o calificaciones verificables para ordenar el historial.');
  if(new Set(notas.map(x=>x.id)).size!==notas.length)return no('Hay ciclos duplicados en la trayectoria; vuelve a consultar.');
  const ordenados=[...notas].sort((a,b)=>a.fecha_inicio!.localeCompare(b.fecha_inicio!)||a.id.localeCompare(b.id));
  const primero=ordenados[0];
  const anteriores=ordenados.filter(x=>x.id!==d.id&&x.fecha_inicio!<d.fecha_inicio!);
  const ultimo=anteriores[anteriores.length-1]||null;
  let fecha=primero.fecha_inicio,cicloFecha:CicloHistorialInscripcion|null=primero;
  let motivo='Ingreso al programa aproximado desde el primer ciclo con notas. La fecha efectiva del destino se captura por separado.';
  if(c.inscripcion?.fecha_primer_ingreso||v.fecha_primer_ingreso){fecha=null;motivo='Se conserva la fecha guardada, capturada o preparada.';}
  else if(primero.fecha_inicio!>d.fecha_inicio){fecha=null;motivo='El primer antecedente es posterior al destino.';}
  else if(ordenados.filter(x=>x.fecha_inicio===primero.fecha_inicio).length!==1){fecha=null;motivo='Dos ciclos comparten la fecha más antigua; revisa la fecha histórica.';}
  else if(v.desde&&v.desde<primero.fecha_inicio!){fecha=null;motivo='El primer ingreso registrado es posterior a la propuesta histórica. Revisa las fechas sin sobrescribirlas.';}
  else if(v.hasta&&v.hasta<primero.fecha_inicio!){fecha=null;motivo='El término capturado es anterior al inicio histórico.';}
  if(!fecha)cicloFecha=null;
  let origen=ultimo,motivoOrigen='Último ciclo anterior al destino con materias calificadas del mismo programa. No autoriza avanzar el grado.';
  if(v.ciclo_origen_id){origen=null;motivoOrigen='Se conserva el origen ya seleccionado o preparado.';}
  else if(v.tipo_ingreso==='PRIMER_INGRESO'){origen=null;motivoOrigen='Primer ingreso se registra sin ciclo anterior de origen.';}
  else if(!ultimo){origen=null;motivoOrigen='No hay un ciclo anterior al destino con calificaciones.';}
  else if(anteriores.filter(x=>x.fecha_inicio===ultimo.fecha_inicio).length!==1){origen=null;motivoOrigen='El último ciclo anterior no es único; revisa el origen.';}
  return {fecha,cicloFecha,origen,motivo,motivoOrigen,materias:cicloFecha?.materias.length||0};
}

/** Solo completa campos vacíos del formulario; el servidor vuelve a validar ambos antecedentes. */
export function aplicarFechaInscripcion(c:CandidatoInscripcion,v:CapturaInscripcion,h:HistorialInscripcion,d?:DestinoFechaInscripcion):CapturaInscripcion {
  const p=proponerFechaInscripcion(c,v,h,d);
  if(!p.fecha&&!p.origen)return v;
  if(v.referencia&&v.referencia.huella!==h.huella)throw new Error('El historial cambió respecto de otras propuestas. Vuelve a revisarlo antes de aplicar.');
  return {...v,...(p.fecha?{fecha_primer_ingreso:p.fecha}:{}),...(p.origen?{ciclo_origen_id:p.origen.id}:{}),referencia:{...v.referencia,
    huella:h.huella,aplicar_ingreso:Boolean(p.fecha)||v.referencia?.aplicar_ingreso||false,aplicar_grado:v.referencia?.aplicar_grado||false,
    ciclo_ingreso_id:p.cicloFecha?.id??v.referencia?.ciclo_ingreso_id??null,fecha_ingreso_propuesta:p.fecha??v.referencia?.fecha_ingreso_propuesta??null,
    grado_propuesto:v.referencia?.grado_propuesto??null,
    aplicar_desde:false,
    ...(p.origen?{aplicar_origen:true,ciclo_origen_propuesto_id:p.origen.id}:{})}};
}

export function fechaInscripcionPropuesta(contexto?:Record<string,unknown>):boolean {
  const v=contexto?.desde;
  return Boolean(v&&typeof v==='object'&&'aproximado' in v&&v.aproximado===true);
}

/** Refresca la huella sin perder la atribución de una fecha/origen de la preparación. */
export function conservarReferenciaFecha(nueva:ReferenciaHistorialInscripcion|undefined,anterior:ReferenciaHistorialInscripcion|null,desde:string):ReferenciaHistorialInscripcion|undefined {
  if(!nueva)return anterior||undefined;
  const r={...nueva};
  if(nueva.aplicar_desde===undefined&&anterior?.aplicar_desde&&desde===anterior.fecha_desde_propuesta)Object.assign(r,{aplicar_desde:true,metodo_desde:anterior.metodo_desde,ciclo_desde_id:anterior.ciclo_desde_id,fecha_desde_propuesta:anterior.fecha_desde_propuesta});
  if(nueva.aplicar_origen===undefined&&anterior?.aplicar_origen)Object.assign(r,{aplicar_origen:true,ciclo_origen_propuesto_id:anterior.ciclo_origen_propuesto_id});
  return r;
}
