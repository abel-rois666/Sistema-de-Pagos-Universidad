import { excluyeDiaLectivo } from '../calendario/calculos';
import { fechaCivilValida } from '../reportes/listadoGeneral';
import type { ContextoDocencia, CorteDocente, PublicacionDocente } from './types';
const DIA=86_400_000;
const fechaUtc=(f:string)=>{if(!fechaCivilValida(f))throw new Error('Revisa las fechas del calendario y de los cortes.');return Date.parse(f+'T00:00:00Z');};
const iso=(v:number)=>new Date(v).toISOString().slice(0,10);
export const diaSiguiente=(f:string)=>iso(fechaUtc(f)+DIA);
export function periodosPagoDocencia(tipo:string){const t=tipo?.trim().toUpperCase();return t==='CUATRIMESTRAL'?{semanas:14,quincenas:7}:t==='SEMESTRAL'?{semanas:16,quincenas:8}:null;}
export function importeCentavos(valor:string|number|null|undefined):number|null{
  if(valor===null||valor===undefined||valor==='')return null;
  const s=String(valor);if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw new Error('La tarifa requiere un importe no negativo con hasta dos decimales.');
  const [entero,decimales='']=s.split('.'),centavos=Number(entero)*100+Number(decimales.padEnd(2,'0'));
  if(!Number.isSafeInteger(centavos)||centavos>999999999999)throw new Error('La tarifa excede el rango admitido.');return centavos;
}
export function repartirCentavos(total:number,cantidad:number){
  if(!Number.isSafeInteger(total)||total<0||!Number.isInteger(cantidad)||cantidad<1)throw new Error('Importe o número de quincenas no válido.');
  const base=Math.floor(total/cantidad);return Array.from({length:cantidad},(_,i)=>i===cantidad-1?total-base*(cantidad-1):base);
}
export function validarCortes(cortes:readonly CorteDocente[],cantidad:number,desde?:string|null,hasta?:string|null){
  if(cortes.length!==cantidad)return `Define ${cantidad} fechas de corte para este ciclo.`;
  for(let i=0;i<cortes.length;i++){
    const c=cortes[i];if(!fechaCivilValida(c.inicio)||!fechaCivilValida(c.fin)||c.inicio>c.fin)return `Revisa las fechas del corte ${i+1}.`;
    if(i&&diaSiguiente(cortes[i-1].fin)!==c.inicio)return 'Los cortes deben ser consecutivos, sin huecos ni superposiciones.';
  }
  if(desde&&cortes[0].inicio>desde||hasta&&cortes.at(-1)!.fin<hasta)return 'Los cortes deben cubrir todo el periodo del calendario.';
  return '';
}
export function sugerirCortes(inicio:string,fin:string,cantidad:number):CorteDocente[]{
  if(!fechaCivilValida(inicio)||!fechaCivilValida(fin)||inicio>fin)return [];
  const cortes:CorteDocente[]=[];let desde=inicio;
  for(let i=0;i<cantidad;i++){
    const d=new Date(fechaUtc(desde));const cierre=d.getUTCDate()<=15?new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),15)):new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0));
    const hasta=i===cantidad-1?fin:iso(+cierre);
    if(desde>hasta||hasta>=fin&&i<cantidad-1)return [];
    cortes.push({inicio:desde,fin:hasta});desde=diaSiguiente(hasta);
  }
  return cortes;
}
export interface EstimacionDocencia {
  presencialesSemana:number; enLineaSemana:number; asincronasSemana:number; semanas:number|null; quincenas:number|null;
  horasCiclo:number|null; horasNoLectivas:number|null; horasPromedioSemana:number|null; totalCentavos:number|null; tarifaCentavos:number|null;
  cuotas:{corte:CorteDocente; horasCalendario:number; importeCentavos:number}[]; avisos:string[];
}
/** Neto del calendario / 7 u 8 cuotas. Asíncronas y cortes nunca generan un segundo descuento. */
export function calcularPagoDocente(contexto:ContextoDocencia,publicado:PublicacionDocente):EstimacionDocencia{
  const grupos=new Map(publicado.entrada.grupos.map(g=>[g.id,g])),cargas=new Map(publicado.entrada.cargas.map(c=>[c.id,c]));
  const sesiones=publicado.sesiones.filter(s=>s.medio!=='EN_LINEA'||grupos.get(s.grupoId)?.planModalidad==='MIXTA');
  const periodo=periodosPagoDocencia(contexto.ciclo.tipo_periodo);
  const r:EstimacionDocencia={presencialesSemana:sesiones.filter(s=>s.medio!=='EN_LINEA').reduce((n,s)=>n+s.fin-s.inicio,0),enLineaSemana:sesiones.filter(s=>s.medio==='EN_LINEA').reduce((n,s)=>n+s.fin-s.inicio,0),asincronasSemana:publicado.entrada.cargas.reduce((n,c)=>n+(c.horasAsincronas||0),0),semanas:periodo?.semanas??null,quincenas:periodo?.quincenas??null,horasCiclo:null,horasNoLectivas:null,horasPromedioSemana:null,totalCentavos:null,tarifaCentavos:null,cuotas:[],avisos:[]};
  if(!contexto.publicacion||!contexto.cargas.length){r.avisos.push('No hay asignaciones del docente en la publicación de este ciclo.');return r;}
  if(!publicado.sesiones.length&&publicado.entrada.cargas.some(c=>(c.horasPresenciales||0)>0)){r.avisos.push('Hay cargas sin sesiones síncronas publicadas. Revisa el horario antes de calcular el pago.');return r;}
  for(let i=0;i<publicado.sesiones.length;i++)for(let j=i+1;j<publicado.sesiones.length;j++){
    const a=publicado.sesiones[i],b=publicado.sesiones[j];if(a.dia===b.dia&&a.inicio<b.fin&&b.inicio<a.fin){r.avisos.push('La publicación contiene sesiones empalmadas. Revisa el horario antes de calcular el pago.');return r;}
  }
  const horasPorFecha=new Map<string,number>();let noLectivas=0;const inicios:string[]=[],fines:string[]=[];
  for(const sesion of sesiones){
    const grupo=grupos.get(sesion.grupoId),carga=cargas.get(sesion.cargaId);
    const candidatos=contexto.calendarios.filter(c=>c.ciclo_id===contexto.ciclo.id&&c.plan_ids.includes(grupo?.planId||'')&&c.modalidad===grupo?.planModalidad&&c.turnos.includes(grupo!.turno));
    if(candidatos.length!==1){r.avisos.push(`${grupo?.codigo||carga?.asignatura||'Asignación'}: ${candidatos.length?'hay más de un calendario aplicable':'falta el calendario de su plan, modalidad y turno'}.`);continue;}
    const cal=candidatos[0];let inicio:number,fin:number;
    try{inicio=fechaUtc(cal.fecha_inicio);fin=fechaUtc(cal.fecha_fin);}catch{r.avisos.push('Un calendario contiene fechas inválidas.');continue;}
    if(fin<inicio||fin-inicio>3660*DIA){r.avisos.push('Revisa el rango de fechas del calendario.');continue;}
    inicios.push(cal.fecha_inicio);fines.push(cal.fecha_fin);
    const eventos=contexto.eventos.filter(e=>e.calendario_id===cal.id);
    if(eventos.some(e=>!fechaCivilValida(e.fecha_inicio)||!fechaCivilValida(e.fecha_fin)||e.fecha_inicio>e.fecha_fin)){r.avisos.push('Revisa las fechas de los eventos del calendario.');continue;}
    for(let f=inicio;f<=fin;f+=DIA){if(new Date(f).getUTCDay()!==sesion.dia)continue;const fecha=iso(f),horas=sesion.fin-sesion.inicio;
      const excluido=eventos.some(e=>e.fecha_inicio<=fecha&&fecha<=e.fecha_fin&&excluyeDiaLectivo({fechaInicio:e.fecha_inicio,fechaFin:e.fecha_fin,tipo:e.tipo,suspendeClases:e.suspende_clases}));
      if(excluido)noLectivas+=horas;else horasPorFecha.set(fecha,(horasPorFecha.get(fecha)||0)+horas);
    }
  }
  if(r.avisos.length){r.avisos=[...new Set(r.avisos)];return r;}
  r.horasCiclo=[...horasPorFecha.values()].reduce((a,b)=>a+b,0);r.horasNoLectivas=noLectivas;
  if(!periodo){r.avisos.push('Define si el ciclo es Cuatrimestral o Semestral para distribuir las quincenas.');return r;}
  r.horasPromedioSemana=r.horasCiclo/periodo.semanas;
  if(!contexto.financiero)return r;
  r.tarifaCentavos=importeCentavos(contexto.financiero.excepcion.monto??contexto.financiero.general.monto);
  if(r.tarifaCentavos===null){r.avisos.push('La tarifa por hora del ciclo todavía no está definida.');return r;}
  const total=r.horasCiclo*r.tarifaCentavos;if(!Number.isSafeInteger(total)){r.avisos.push('El importe calculado excede el rango admitido.');return r;}
  r.totalCentavos=total;const cortes=contexto.financiero.general.cortes||[];
  const error=validarCortes(cortes,periodo.quincenas,inicios.sort()[0],fines.sort().at(-1));
  if(error){r.avisos.push(error);return r;}
  const importes=repartirCentavos(total,periodo.quincenas);
  r.cuotas=cortes.map((c,i)=>({corte:c,horasCalendario:[...horasPorFecha].filter(([f])=>f>=c.inicio&&f<=c.fin).reduce((n,[,h])=>n+h,0),importeCentavos:importes[i]}));
  return r;
}
