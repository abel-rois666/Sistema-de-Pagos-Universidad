import type { Alumno, PaymentPlan, PlantillaPlan } from '../types';
import { calculateStudentTotals } from '../utils';
import { compararGrados, gradoCanonico } from './promocionAlumnos';

export interface FiltrosPadron { busqueda: string; licenciaturas: string[]; grados: string[]; turnos: string[]; estatus: string[] }
export const filtrosPadronVacios = (): FiltrosPadron => ({busqueda:'',licenciaturas:[],grados:[],turnos:[],estatus:[]});
export function plantillaDisponibleEnCiclo(plantilla:Pick<PlantillaPlan,'activo'|'ciclo_id'>|undefined,cicloId:string) {
  return Boolean(cicloId&&plantilla?.activo&&(!plantilla.ciclo_id||plantilla.ciclo_id===cicloId));
}
const normalizar = (v?: string | null) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function filtrarPadron(alumnos: readonly Alumno[], filtros: FiltrosPadron) {
  const consulta = normalizar(filtros.busqueda);
  return alumnos.filter(a => (!consulta || [a.nombre_completo,a.matricula,a.licenciatura].some(v=>normalizar(v).includes(consulta)))
    && (!filtros.licenciaturas.length || filtros.licenciaturas.includes(a.licenciatura))
    && (!filtros.grados.length || filtros.grados.includes(gradoCanonico(a.grado_actual)))
    && (!filtros.turnos.length || filtros.turnos.includes(a.turno))
    && (!filtros.estatus.length || filtros.estatus.includes(a.estatus || '')));
}
export function ordenarPadron(alumnos: readonly Alumno[], campo: keyof Alumno, direccion: 'asc'|'desc') {
  return [...alumnos].sort((a,b)=> (campo==='grado_actual' ? compararGrados(a.grado_actual,b.grado_actual)
    : String(a[campo]||'').localeCompare(String(b[campo]||''),'es',{numeric:true,sensitivity:'base'})) * (direccion==='asc'?1:-1)
    || a.id.localeCompare(b.id));
}
export interface RegistroReporteFinanciero { id:string; nombre:string; licenciatura:string; grado:string; estatus:string; tienePlan:boolean; pagado:number; adeuda:number }
export function ordenarReporteFinanciero(registros:readonly RegistroReporteFinanciero[], campo:'nombre'|'grado'|'pagado'|'adeuda', sentido:'asc'|'desc') {
  return [...registros].sort((a,b)=>(campo==='nombre'?a.nombre.localeCompare(b.nombre,'es',{numeric:true,sensitivity:'base'}):campo==='grado'?compararGrados(a.grado,b.grado):a[campo]-b[campo])*(sentido==='asc'?1:-1)||a.id.localeCompare(b.id));
}
export function ordenarMesesReporte(meses:readonly string[]) {
  const nombres=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const valor=(s:string)=>(Number(s.match(/\d{4}/)?.[0])||0)*12+nombres.findIndex(n=>s.toUpperCase().startsWith(n));
  return [...meses].sort((a,b)=>valor(b)-valor(a)||a.localeCompare(b,'es'));
}
/** No atribuye importes por nombre. Los legados sin identidad se muestran para revisión por separado. */
export function construirReporteFinanciero(alumnos: readonly Alumno[], poblacion: readonly Alumno[], planes: readonly PaymentPlan[], opciones: {tipo:string; mes:string; omitirSinPlan:boolean}) {
  const ids = new Set(alumnos.map(a=>a.id));
  const porAlumno = new Map<string,PaymentPlan[]>();
  const pendientes: PaymentPlan[] = [];
  for (const p of planes) {
    if (opciones.tipo==='Ordinario' && p.tipo_plan==='Titulación' || opciones.tipo==='Titulación' && p.tipo_plan!=='Titulación') continue;
    if (!p.alumno_id || !ids.has(p.alumno_id)) { pendientes.push(p); continue; }
    porAlumno.set(p.alumno_id,[...(porAlumno.get(p.alumno_id)||[]),p]);
  }
  const registros: RegistroReporteFinanciero[] = poblacion.map(a=>{
    const propios = porAlumno.get(a.id)||[];
    const totales=propios.reduce((total,p)=>{const t=calculateStudentTotals(p,a.estatus,opciones.mes==='Todos'?undefined:opciones.mes);return {pagado:total.pagado+t.paid,adeuda:total.adeuda+t.owed};},{pagado:0,adeuda:0});
    return {id:a.id,nombre:a.nombre_completo,licenciatura:a.licenciatura||'',grado:a.grado_actual||'',estatus:a.estatus||'ACTIVO',tienePlan:propios.length>0,...totales};
  }).filter(r=>!opciones.omitirSinPlan||r.tienePlan);
  return {registros,pendientes};
}
