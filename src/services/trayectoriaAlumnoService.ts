import { conResponsablesHistorial } from './responsablesHistorialService';
import { fetchAllSupabase, supabase } from '../lib/supabase';
import type { InscripcionCiclo, PreparacionInscripcion } from '../inscripciones/types';

export interface IngresoPrograma {
 alumno_programa_id:string;ciclo_id:string|null;fecha:string|null;
 calidad:'DOCUMENTADA'|'APROXIMADA'|'PENDIENTE';evidencia:string;motivo:string;revision:number;
}
export interface ProgramaTrayectoria {
 id:string;plan_id:string;es_vigente:boolean;estatus:string;fecha_inscripcion:string|null;created_at?:string;
 planes_estudio:{nombre:string;clave_legado:string;tipo_periodo:string}|null;
}
export const trayectoriaAlumnoService={
 async ingresosProgramas(ids:string[]):Promise<{ingresos:IngresoPrograma[];habilitado:boolean}>{
  if(!ids.length)return {ingresos:[],habilitado:true};
  const ingresos:IngresoPrograma[]=[];
  for(let inicio=0;inicio<ids.length;inicio+=100){
   const {data,error}=await fetchAllSupabase(()=>supabase.from('inscripciones_programa_ingreso').select('alumno_programa_id,ciclo_id,fecha,calidad,evidencia,motivo,revision').in('alumno_programa_id',ids.slice(inicio,inicio+100)).order('alumno_programa_id'));
   if(error){if(['42P01','PGRST205'].includes(error.code))return {ingresos:[],habilitado:false};throw error;}
   ingresos.push(...data||[]);
  }
  return {ingresos,habilitado:true};
 },
 async consultar(alumnoId:string) {
  const programas=await fetchAllSupabase(()=>supabase.from('alumno_programas').select('*,planes_estudio(nombre,clave_legado,tipo_periodo)').eq('alumno_id',alumnoId).order('id'));
  if(programas.error)throw programas.error;
  const filas=(programas.data||[]) as unknown as ProgramaTrayectoria[],ids=filas.map(p=>p.id);
  if(!ids.length)return {programas:filas,inscripciones:[] as InscripcionCiclo[],preparaciones:[] as PreparacionInscripcion[],ingresos:[] as IngresoPrograma[],ingresoDisponible:false};
  const [inscripciones,preparaciones,ingresos]=await Promise.all([
   fetchAllSupabase(()=>supabase.from('inscripciones_ciclo').select('*').in('alumno_programa_id',ids).order('id')),
   fetchAllSupabase(()=>supabase.from('inscripciones_ciclo_preparaciones').select('*').in('alumno_programa_id',ids).order('id')),
   fetchAllSupabase(()=>supabase.from('inscripciones_programa_ingreso').select('*').in('alumno_programa_id',ids).order('alumno_programa_id')),
  ]);
  if(inscripciones.error)throw new Error('No se pudo consultar la matrícula central: '+inscripciones.error.message);
  const ausente=(error:{code?:string}|null)=>error&&['42P01','PGRST205'].includes(error.code||'');
  if(preparaciones.error&&!ausente(preparaciones.error))throw preparaciones.error;
  if(ingresos.error&&!ausente(ingresos.error))throw ingresos.error;
  return {programas:filas,inscripciones:(inscripciones.data||[]) as InscripcionCiclo[],preparaciones:(preparaciones.data||[]) as PreparacionInscripcion[],ingresos:(ingresos.data||[]) as IngresoPrograma[],ingresoDisponible:!ingresos.error};
 },
 async guardar(ingreso:IngresoPrograma) {
  const {error}=await supabase.rpc('ic_guardar_ingreso_programa',{p_programa:ingreso.alumno_programa_id,p_revision:ingreso.revision,p_ciclo:ingreso.ciclo_id,p_fecha:ingreso.fecha,p_calidad:ingreso.calidad,p_evidencia:ingreso.evidencia,p_motivo:ingreso.motivo});
  if(error)throw error;
 },
 async bitacora(programaId:string) {
  const {data,error}=await fetchAllSupabase(()=>supabase.from('inscripciones_programa_ingreso_historial').select('id,creado_en,creado_por,antes,despues').eq('alumno_programa_id',programaId).order('creado_en',{ascending:false}).order('id'));
  if(error)throw error;return conResponsablesHistorial(data||[]);
 },
};
