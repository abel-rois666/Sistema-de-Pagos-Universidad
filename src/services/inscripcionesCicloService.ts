import { conResponsablesHistorial } from './responsablesHistorialService';
import { fetchAllSupabase, supabase } from '../lib/supabase';
import type { CandidatoInscripcion, CapturaInscripcion, ContextoInscripcion, PreparacionInscripcion } from '../inscripciones/types';

export const faltaFuncionInscripciones=(e:{code?:string;message?:string})=>e.code==='PGRST202'||e.code==='42883';
async function comprobarPropuestasFecha(filas:{referencia?:CapturaInscripcion['referencia']|null}[]) {
  if(filas.some(f=>f.referencia?.aplicar_desde&&f.referencia.metodo_desde==='HISTORIAL_MAS_ANTIGUO'))throw new Error('Revisa la preparación histórica: el primer ciclo corresponde al ingreso al programa. Captura por separado la fecha de inscripción del destino y confirma la revisión manual.');
  if(!filas.some(f=>(f.referencia?.aplicar_desde||f.referencia?.aplicar_origen)))return;
  const {data,error}=await supabase.rpc('ic_configuracion');if(error)throw error;
  if(filas.some(f=>f.referencia?.metodo_desde==='HISTORIAL_MAS_ANTIGUO'||f.referencia?.aplicar_origen)&&data?.propuesta_fecha_historial!==true)throw new Error('Instala la actualización de fecha histórica y ciclo de origen antes de guardar estas propuestas.');
  if(data?.propuesta_fecha_inscripcion!==true)throw new Error('Instala la actualización de fechas propuestas antes de guardar o confirmar esta procedencia.');
}
export const inscripcionesCicloService={
  async consultar(cicloId:string,incluirHistoricos:boolean):Promise<CandidatoInscripcion[]> {
    const {data,error}=await fetchAllSupabase(()=>supabase.rpc('ic_consultar',{p_ciclo:cicloId,p_historicos:incluirHistoricos}).order('nombre').order('alumno_programa_id'));
    if(error)throw new Error(faltaFuncionInscripciones(error)?'Falta instalar la migración de Inscripciones por ciclo. Los flujos anteriores se conservan.':error.message);
    return data||[];
  },
  async guardar(filas:{candidato:CandidatoInscripcion;captura:CapturaInscripcion}[],cicloId:string,conProcedencia=false):Promise<number> {
    if(!conProcedencia&&filas.some(f=>f.captura.referencia))throw new Error('Instala la actualización de procedencia antes de guardar propuestas del historial.');
    await comprobarPropuestasFecha(filas.map(f=>f.captura));
    const {data,error}=await supabase.rpc(conProcedencia?'ic_guardar_revision':'ic_guardar_lote',{p_ciclo:cicloId,p_filas:filas.map(({candidato:c,captura:v})=>({
      ...v,plan_id:c.plan_id,alumno_programa_id:c.alumno_programa_id,revision:c.inscripcion?.revision||0,
      inscripcion_id:c.inscripcion?.id||null,
    }))});
    if(error)throw error;return data as number;
  },
  async historial(inscripcionId:string) {
    const {data,error}=await fetchAllSupabase(()=>supabase.from('inscripciones_ciclo_historial').select('id,creado_en,creado_por,motivo,antes,despues').eq('inscripcion_id',inscripcionId).order('creado_en',{ascending:false}).order('id'));
    if(error)throw error;
    const contextos=await fetchAllSupabase(()=>supabase.from('inscripciones_ciclo_contextos').select('inscripcion_id,revision,ciclo_origen_id,contexto').eq('inscripcion_id',inscripcionId).order('revision'));
    if(contextos.error&&contextos.error.code!=='PGRST205'&&contextos.error.code!=='42P01')throw contextos.error;
    return conResponsablesHistorial((data||[]).map(h=>({...h,procedencia:contextos.data?.find(c=>c.revision===h.despues.revision)})));
  },
  async configuracion():Promise<{version:number;integrar_promocion:boolean;puente_911:boolean;preparaciones?:boolean;propuesta_fecha_inscripcion?:boolean;propuesta_fecha_historial?:boolean}> {
    const {data,error}=await supabase.rpc('ic_configuracion');if(error)throw error;return data;
  },
  async integrarPromocion(valor:boolean) {
    const {error}=await supabase.rpc('ic_integrar_promocion',{p_activar:valor});if(error)throw error;
  },
  async enviar911(filas:CandidatoInscripcion[]):Promise<{creadas:number;conservadas:number}> {
    const {data,error}=await supabase.rpc('ic_acreditar_911',{p_fuentes:filas.map(c=>({id:c.inscripcion!.id,revision:c.inscripcion!.revision}))});
    if(error)throw error;return data;
  },
  async conContextos(filas:CandidatoInscripcion[]):Promise<CandidatoInscripcion[]> {
    const contextos:ContextoInscripcion[]=[];
    const ids=filas.flatMap(c=>c.inscripcion?[c.inscripcion.id]:[]);
    for(let inicio=0;inicio<ids.length;inicio+=100) {
      const {data,error}=await fetchAllSupabase(()=>supabase.from('inscripciones_ciclo_contextos').select('inscripcion_id,revision,ciclo_origen_id,contexto').in('inscripcion_id',ids.slice(inicio,inicio+100)).order('id'));
      if(error)throw error;contextos.push(...data||[]);
    }
    const ingresos: {alumno_programa_id:string;fecha:string|null;calidad:string;ciclo_id:string|null}[]=[];
    for(let i=0;i<filas.length;i+=100){const r=await fetchAllSupabase(()=>supabase.from('inscripciones_programa_ingreso').select('alumno_programa_id,fecha,calidad,ciclo_id').in('alumno_programa_id',filas.slice(i,i+100).map(c=>c.alumno_programa_id)).order('alumno_programa_id'));if(r.error&&!['42P01','PGRST205'].includes(r.error.code))throw r.error;ingresos.push(...r.data||[]);}
    return filas.map(c=>({...c,ingreso_programa:ingresos.find(i=>i.alumno_programa_id===c.alumno_programa_id),contexto_actual:contextos.find(x=>x.inscripcion_id===c.inscripcion?.id&&x.revision===c.inscripcion?.revision)}));
  },
  async preparaciones(ciclo:string):Promise<PreparacionInscripcion[]> {
    const {data,error}=await fetchAllSupabase(()=>supabase.from('inscripciones_ciclo_preparaciones').select('*').eq('ciclo_id',ciclo).order('actualizado_en',{ascending:false}).order('id'));
    if(error)throw error;return data||[];
  },
  async preparar(filas:{candidato:CandidatoInscripcion;captura:CapturaInscripcion}[],ciclo:string,ids:Record<string,{id:string;revision:number}>):Promise<number> {
    await comprobarPropuestasFecha(filas.map(f=>f.captura));
    const {data,error}=await supabase.rpc('ic_preparar_lote',{p_ciclo:ciclo,p_filas:filas.map(({candidato:c,captura:v})=>({...v,
      plan_id:c.plan_id,alumno_programa_id:c.alumno_programa_id,inscripcion_id:c.inscripcion?.id||null,revision:c.inscripcion?.revision||0,
      preparacion_id:ids[c.alumno_programa_id].id,preparacion_revision:ids[c.alumno_programa_id].revision}))});
    if(error)throw error;return data;
  },
  async confirmarPreparaciones(filas:PreparacionInscripcion[],avanzar:boolean):Promise<number> {
    await comprobarPropuestasFecha(filas);
    const {data,error}=await supabase.rpc('ic_confirmar_lote_preparado',{p_fuentes:filas.map(p=>({id:p.id,revision:p.revision})),p_avanzar:avanzar});
    if(error)throw error;return data;
  },
  async cancelarPreparacion(p:PreparacionInscripcion,motivo:string) {
    const {error}=await supabase.rpc('ic_cancelar_preparacion',{p_id:p.id,p_revision:p.revision,p_motivo:motivo});if(error)throw error;
  },
  async historialPreparacion(id:string) {
    const {data,error}=await fetchAllSupabase(()=>supabase.from('inscripciones_ciclo_preparaciones_historial').select('id,creado_en,creado_por,motivo,antes,despues').eq('preparacion_id',id).order('creado_en',{ascending:false}).order('id'));
    if(error)throw error;return conResponsablesHistorial(data||[]);
  },
};
