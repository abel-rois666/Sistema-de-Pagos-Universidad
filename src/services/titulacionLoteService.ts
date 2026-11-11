import {supabase} from '../lib/supabase';
import type {CandidatoCertificacion} from './certificacionLoteService';
const mensaje=(e:{code?:string;message:string})=>new Error(['PGRST202','42883'].includes(e.code||'')?'Falta instalar la asociación masiva (20261110100000). No se modificó ninguna ficha.':e.message);
export const titulacionLoteService={
 async consultar(desde:number,busqueda:string,signal:AbortSignal,vista='todos',alumno=''):Promise<{total:number;filas:CandidatoCertificacion[]}>{
  const {data,error}=await supabase.rpc('titulacion_lote_preview_v1',{p_desde:desde,p_busqueda:busqueda,p_vista:vista,p_alumno:alumno||null}).abortSignal(signal);
  if(error)throw mensaje(error);
  if(!data||!Number.isInteger(data.total)||!Array.isArray(data.filas))throw new Error('El servidor no confirmó la vista previa.');
  return data;
 },
 async asociar(filas:CandidatoCertificacion[],motivo:string){
  const {data,error}=await supabase.rpc('titulacion_asociar_lote_v1',{p_filas:filas.map(f=>({id:f.id,programaId:f.programaId,huella:f.huella})),p_motivo:motivo.trim()});
  if(error)throw mensaje(error);
  if(data!==filas.length)throw new Error('No se pudo confirmar el lote. Actualiza la consulta antes de reintentar.');
  return data as number;
 }
};
