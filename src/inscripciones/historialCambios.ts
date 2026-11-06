export interface EventoHistorial {
 id?:string;creado_en?:string;creado_por?:string;responsable?:string;motivo?:string;
 antes?:Record<string,unknown>|null;despues?:Record<string,unknown>;
 procedencia?:{contexto?:Record<string,unknown>};
}
const etiquetas:Record<string,string>={estado:'Situación de la inscripción',estado_preparacion:'Situación de la preparación',ciclo_id:'Ciclo',ciclo_origen_id:'Ciclo anterior de origen',desde:'Fecha efectiva de inscripción',hasta:'Último día inscrito',grado_personal:'Grado personal',tipo_ingreso:'Tipo de ingreso',fecha_primer_ingreso:'Primer ingreso al programa',fecha:'Fecha de ingreso',calidad:'Calidad del antecedente',evidencia:'Respaldo'};
const valores:Record<string,string>={CONFIRMADA:'Inscripción confirmada',CANCELADA:'Cancelada',BAJA:'Baja',PENDIENTE:'Pendiente',PRIMER_INGRESO:'Primer ingreso',REINGRESO:'Reingreso',DESCONOCIDO:'Pendiente de acreditar',DOCUMENTADA:'Documentado',APROXIMADA:'Aproximado'};
const objeto=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function datosEvento(v:Record<string,unknown>|null|undefined):Record<string,unknown>{
 if(!v)return {};
 return v.datos?{...objeto(v.datos),ciclo_id:v.ciclo_id,ciclo_origen_id:v.ciclo_origen_id,estado_preparacion:v.estado}:v;
}
export function camposEvento(e:EventoHistorial){
 const antes=datosEvento(e.antes),despues=datosEvento(e.despues),inicial=!e.antes;
 return Object.entries(etiquetas).filter(([k])=>(k in antes||k in despues)&&(inicial||antes[k]!==despues[k]))
  .map(([clave,etiqueta])=>({clave,etiqueta,antes:antes[clave],despues:despues[clave]}));
}
export function tituloEvento(e:EventoHistorial){
 const preparacion=Boolean(e.despues?.datos),ingreso=Boolean(e.despues&&'calidad' in e.despues);
 const estado=preparacion?e.despues?.estado:datosEvento(e.despues).estado;
 if(preparacion)return estado==='CONFIRMADA'?'Preparación confirmada':estado==='CANCELADA'?'Preparación cancelada':!e.antes?'Preparación guardada':'Preparación actualizada';
 if(ingreso)return !e.antes?'Ingreso al programa registrado':'Ingreso al programa corregido';
 if(estado==='CANCELADA'&&e.antes?.estado!==estado)return 'Inscripción cancelada';
 if(estado==='BAJA'&&e.antes?.estado!==estado)return 'Baja registrada';
 return !e.antes?'Inscripción registrada':'Inscripción corregida';
}
export function ordenarEventos(filas:readonly EventoHistorial[]){
 const fecha=(f?:string)=>{const n=Date.parse(f||'');return Number.isFinite(n)?n:0;};
 return [...filas].sort((a,b)=>fecha(b.creado_en)-fecha(a.creado_en)||(b.id||'').localeCompare(a.id||''));
}
export function textoCampoHistorial(clave:string,valor:unknown,ciclo:(id:string|null)=>string):string{
 if(valor===null||valor===undefined||valor==='')return clave==='hasta'?'Sin término registrado':'Sin dato';
 if(clave==='ciclo_id'||clave==='ciclo_origen_id')return ciclo(String(valor));
 if(typeof valor!=='string'&&typeof valor!=='number')return 'Dato pendiente de revisión';
 const texto=String(valor);
 if(clave==='estado_preparacion')return ({PENDIENTE:'Preparación pendiente',CONFIRMADA:'Preparación confirmada',CANCELADA:'Preparación cancelada'} as Record<string,string>)[texto]||texto;
 if(['desde','hasta','fecha','fecha_primer_ingreso'].includes(clave)&&/^\d{4}-\d{2}-\d{2}$/.test(texto))return texto.split('-').reverse().join('/');
 return valores[texto]||texto;
}
export function aproximacionesEvento(e:EventoHistorial){
 const contexto=e.procedencia?.contexto||objeto(e.despues?.contexto);
 return ['ingreso','desde','grado'].filter(k=>objeto(contexto[k]).aproximado===true).map(k=>k==='ingreso'?'Primer ingreso aproximado':k==='desde'?'Fecha efectiva aproximada':'Grado propuesto');
}
